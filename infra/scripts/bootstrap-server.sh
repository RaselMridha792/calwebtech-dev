#!/usr/bin/env bash
# Prepares a fresh Ubuntu 24.04 LTS server, once, as root, so that the release workflow
# (.github/workflows/release.yml, job "deploy") can rsync infra/ to it as the `deploy`
# user and run infra/scripts/deploy.sh over SSH.
#
# Copy infra/ to the server first, then run the script from it in one command:
#
#   rsync -a infra/ root@<ip>:/srv/calwebtech/infra/
#   sudo STACK=staging SITE_HOST=staging.calwebtech.com ACME_EMAIL=ops@calwebtech.com \
#     DEPLOY_PUBKEY="ssh-ed25519 AAAA... ci" STAGING_BASIC_AUTH=preview:some-password \
#     bash /srv/calwebtech/infra/scripts/bootstrap-server.sh
#
# Inputs, all environment variables:
#   STACK               staging or production                                   required
#   SITE_HOST           public host name of the stack                           required
#   ACME_EMAIL          Let's Encrypt account address for Traefik               required
#   DEPLOY_PUBKEY       public half of the CI's key (VPS_SSH_KEY in GitHub)     required
#   STAGING_BASIC_AUTH  user:password in front of staging                       required on staging
#   APP_ORIGIN          default https://$SITE_HOST
#   ADMIN_PUBKEY        a person's public key, added to root and deploy         optional
#   SSH_PORT            the port sshd already listens on; default read from sshd, else 22.
#                       The script does not move the port.
#   DEPLOY_ROOT         default /srv/calwebtech, as in deploy.sh. The workflow rsyncs to
#                       /srv/calwebtech/infra whatever this is.
#   ALLOW_OTHER_OS      true to only warn on an OS other than Ubuntu 24.04
#
# What it does: Docker Engine and the compose plugin from Docker's repository with log
# rotation and live-restore; the `deploy` user, key-only, in the docker group; the
# directories deploy.sh and Traefik expect under $DEPLOY_ROOT; the stack's env file from
# infra/env/<stack>.env.example with generated secrets; on staging the basic-auth users
# file; a 2 GB swapfile on a box without swap; UFW; fail2ban; sshd hardening; unattended
# security updates; time sync. It ends by printing the GitHub secrets and the steps left.
#
# Re-running is safe: every step checks before it acts. The env file and the users file
# are never overwritten once they exist, because they hold the live tag, the database
# password and the staging credential.
set -euo pipefail

STACK="${STACK:-}"
SITE_HOST="${SITE_HOST:-}"
ACME_EMAIL="${ACME_EMAIL:-}"
DEPLOY_PUBKEY="${DEPLOY_PUBKEY:-}"
STAGING_BASIC_AUTH="${STAGING_BASIC_AUTH:-}"
APP_ORIGIN="${APP_ORIGIN:-}"
ADMIN_PUBKEY="${ADMIN_PUBKEY:-}"
SSH_PORT="${SSH_PORT:-}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/srv/calwebtech}"
ALLOW_OTHER_OS="${ALLOW_OTHER_OS:-}"

DEPLOY_USER="deploy"
DEPLOY_HOME="/home/$DEPLOY_USER"
INFRA="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$DEPLOY_ROOT/env/$STACK.env"
ENV_EXAMPLE="$INFRA/env/$STACK.env.example"
HTPASSWD_FILE="$DEPLOY_ROOT/secrets/staging.htpasswd"

# apt must never wait for a keyboard: no dpkg prompts, and no needrestart dialog (Ubuntu
# 24.04 shows one after every install that touches a running service).
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

die() {
  echo "bootstrap: $1" >&2
  exit 1
}
warn() {
  echo "bootstrap: warning: $1" >&2
}

# ---- helpers

APT_UPDATED=false
pkg_installed() {
  [ "$(dpkg-query -W -f='${Status}' "$1" 2>/dev/null || true)" = "install ok installed" ]
}
apt_install() {
  local missing=()
  local pkg
  for pkg in "$@"; do
    pkg_installed "$pkg" || missing+=("$pkg")
  done
  [ "${#missing[@]}" -gt 0 ] || return 0
  if [ "$APT_UPDATED" != "true" ]; then
    apt-get update -qq
    APT_UPDATED=true
  fi
  # Recommends stay on: fail2ban's systemd backend needs python3-systemd from there.
  apt-get install -y -qq "${missing[@]}"
}

# Writes stdin to a file only when the content differs. Returns 0 when it wrote, 1 when
# the file was already right, so callers restart a service only on a real change.
write_file() {
  local path="$1" mode="$2" content
  content="$(cat)"
  if [ -f "$path" ] && [ "$(cat "$path")" = "$content" ]; then
    chmod "$mode" "$path"
    return 1
  fi
  printf '%s\n' "$content" > "$path"
  chmod "$mode" "$path"
  return 0
}

# A public key line, first line only, without surrounding whitespace.
clean_key() {
  printf '%s\n' "$1" | head -n 1 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}
valid_key() {
  ssh-keygen -l -f <(printf '%s\n' "$1") >/dev/null 2>&1
}
# Appends a key to an authorized_keys file unless the key material is already in it,
# whatever its comment says.
add_authorized_key() {
  local file="$1" key="$2" owner="$3" material
  material="$(printf '%s' "$key" | awk '{print $2}')"
  install -d -m 700 -o "$owner" -g "$owner" "$(dirname "$file")"
  [ -f "$file" ] || : > "$file"
  chmod 600 "$file"
  chown "$owner:$owner" "$file"
  if ! grep -qF -- "$material" "$file"; then
    printf '%s\n' "$key" >> "$file"
  fi
}
has_authorized_key() {
  [ -f "$1" ] && grep -qE '^(ssh-|ecdsa-|sk-)' "$1"
}

# Env file helpers. Values are written by a bash loop, never through sed, so passwords
# and addresses with sed's special characters (&, /, |) go in unchanged.
env_get() {
  grep -E "^$2=" "$1" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' || true
}
env_set() {
  local file="$1" key="$2" value="$3" found=false line tmp
  tmp="$file.tmp"
  : > "$tmp"
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" == "$key="* ]]; then
      printf '%s=%s\n' "$key" "$value" >> "$tmp"
      found=true
    else
      printf '%s\n' "$line" >> "$tmp"
    fi
  done < "$file"
  [ "$found" = "true" ] || printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$file"
}

# The port sshd is configured for. With socket activation Ubuntu 24.04 still derives the
# socket from sshd_config, so this is what the box listens on.
configured_ssh_port() {
  local port
  port="$(sshd -T 2>/dev/null | awk '$1 == "port" { print $2; exit }' || true)"
  printf '%s\n' "${port:-22}"
}

# ---- preflight: refuse before anything changes

preflight() {
  [ "$(id -u)" -eq 0 ] || die "run as root (sudo)"
  command -v sshd >/dev/null 2>&1 || die "sshd is not installed; this box is not reachable by SSH"

  case "$STACK" in
    staging|production) ;;
    "") die "STACK is required: staging or production" ;;
    *) die "STACK must be staging or production, not '$STACK'" ;;
  esac
  [ -n "$SITE_HOST" ] || die "SITE_HOST is required, e.g. staging.calwebtech.com"
  [[ "$SITE_HOST" != *"://"* && "$SITE_HOST" != *"/"* ]] || die "SITE_HOST is a host name, not a URL"
  [ -n "$ACME_EMAIL" ] || die "ACME_EMAIL is required (the Let's Encrypt account address)"
  [[ "$ACME_EMAIL" == ?*@?*.?* ]] || die "ACME_EMAIL does not look like an email address"
  [ -n "$DEPLOY_PUBKEY" ] || die "DEPLOY_PUBKEY is required (the public half of the CI's SSH key)"
  DEPLOY_PUBKEY="$(clean_key "$DEPLOY_PUBKEY")"
  valid_key "$DEPLOY_PUBKEY" || die "DEPLOY_PUBKEY is not a valid OpenSSH public key"
  if [ -n "$ADMIN_PUBKEY" ]; then
    ADMIN_PUBKEY="$(clean_key "$ADMIN_PUBKEY")"
    valid_key "$ADMIN_PUBKEY" || die "ADMIN_PUBKEY is not a valid OpenSSH public key"
  fi
  if [ "$STACK" = "staging" ]; then
    [ -n "$STAGING_BASIC_AUTH" ] || die "STAGING_BASIC_AUTH=user:password is required on staging"
    [[ "$STAGING_BASIC_AUTH" == ?*:?* ]] || die "STAGING_BASIC_AUTH must be user:password"
  fi
  [ -n "$APP_ORIGIN" ] || APP_ORIGIN="https://$SITE_HOST"
  if [ -n "$SSH_PORT" ]; then
    [[ "$SSH_PORT" =~ ^[0-9]+$ ]] && [ "$SSH_PORT" -ge 1 ] && [ "$SSH_PORT" -le 65535 ] ||
      die "SSH_PORT must be a port number"
    if [ "$SSH_PORT" != "$(configured_ssh_port)" ]; then
      warn "SSH_PORT=$SSH_PORT but sshd is configured for port $(configured_ssh_port); the script does not move the port"
    fi
  else
    SSH_PORT="$(configured_ssh_port)"
  fi
  if [ ! -f "$ENV_FILE" ] && [ ! -f "$ENV_EXAMPLE" ]; then
    die "$ENV_FILE does not exist and there is no $ENV_EXAMPLE to create it from"
  fi

  # The OS. Docker's repository, the ssh unit name and the sshd drop-in directory below
  # are Ubuntu 24.04's; elsewhere the script is a best effort.
  local os_id="" os_version=""
  if [ -r /etc/os-release ]; then
    os_id="$(. /etc/os-release && printf '%s' "${ID:-}")"
    os_version="$(. /etc/os-release && printf '%s' "${VERSION_ID:-}")"
  fi
  if [ "$os_id" != "ubuntu" ] || [ "$os_version" != "24.04" ]; then
    if [ "$ALLOW_OTHER_OS" = "true" ]; then
      warn "this is ${os_id:-an unknown OS} ${os_version:-}, not Ubuntu 24.04; continuing because ALLOW_OTHER_OS=true"
    else
      die "this is ${os_id:-an unknown OS} ${os_version:-}, not Ubuntu 24.04 (ALLOW_OTHER_OS=true overrides)"
    fi
  fi

  # Password logins are switched off below. Refuse if that would leave no way in with
  # sudo: root keeps key access, so root, or the person running sudo, needs a key first.
  local password_auth
  password_auth="$(sshd -T 2>/dev/null | awk '$1 == "passwordauthentication" { print $2; exit }' || true)"
  if [ "${password_auth:-yes}" = "yes" ] && [ -z "$ADMIN_PUBKEY" ]; then
    local sudo_home=""
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
      sudo_home="$(getent passwd "$SUDO_USER" | cut -d: -f6 || true)"
    fi
    if ! has_authorized_key /root/.ssh/authorized_keys &&
       { [ -z "$sudo_home" ] || ! has_authorized_key "$sudo_home/.ssh/authorized_keys"; }; then
      die "password logins are about to be disabled and neither root nor ${SUDO_USER:-root} has an authorized key; pass ADMIN_PUBKEY"
    fi
  fi
}

# ---- steps

install_base_packages() {
  echo "bootstrap: base packages"
  # rsync: the release workflow copies infra/ to the server with it; minimal images lack it.
  apt_install ca-certificates curl gnupg openssl rsync apache2-utils ufw fail2ban unattended-upgrades
}

configure_docker_daemon() {
  echo "bootstrap: docker daemon config"
  # Written before the engine is installed so the first start already rotates logs. A
  # 4 GB box with unrotated json-file logs fills its disk; live-restore keeps containers
  # up while the daemon itself restarts for an upgrade.
  install -d -m 755 /etc/docker
  if write_file /etc/docker/daemon.json 644 <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true
}
JSON
  then
    if systemctl is-active --quiet docker; then
      echo "bootstrap: docker daemon config changed, restarting docker"
      systemctl restart docker
    fi
  fi
}

install_docker() {
  echo "bootstrap: docker engine and compose plugin"
  # Docker's own repository, not Ubuntu's docker.io, so the engine and the compose plugin
  # are current and upgrade together. Ubuntu's packages conflict and are removed first.
  local pkg conflicting=()
  for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
    pkg_installed "$pkg" && conflicting+=("$pkg")
  done
  if [ "${#conflicting[@]}" -gt 0 ]; then
    echo "bootstrap: removing Ubuntu's ${conflicting[*]}"
    apt-get remove -y -qq "${conflicting[@]}"
  fi

  local os_id codename arch
  os_id="$(. /etc/os-release && printf '%s' "${ID:-ubuntu}")"
  codename="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME:-noble}")"
  arch="$(dpkg --print-architecture)"
  install -d -m 755 /etc/apt/keyrings
  if [ ! -s /etc/apt/keyrings/docker.asc ]; then
    curl -fsSL "https://download.docker.com/linux/$os_id/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  if write_file /etc/apt/sources.list.d/docker.list 644 <<EOF
deb [arch=$arch signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$os_id $codename stable
EOF
  then
    APT_UPDATED=false
  fi
  apt_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker >/dev/null 2>&1
  docker compose version >/dev/null 2>&1 || die "docker compose is not working after the install"
}

create_deploy_user() {
  echo "bootstrap: $DEPLOY_USER user"
  # The CI connects as this user with VPS_SSH_KEY; only the public half lives here. No
  # password is ever set. Membership of the docker group is root-equivalent on this box,
  # which is the access deploy.sh needs and no more than the CI already has.
  if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
    useradd --create-home --home-dir "$DEPLOY_HOME" --shell /bin/bash "$DEPLOY_USER"
  fi
  getent group docker >/dev/null || groupadd docker
  if ! id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx docker; then
    usermod -aG docker "$DEPLOY_USER"
  fi
  add_authorized_key "$DEPLOY_HOME/.ssh/authorized_keys" "$DEPLOY_PUBKEY" "$DEPLOY_USER"
  if [ -n "$ADMIN_PUBKEY" ]; then
    add_authorized_key "$DEPLOY_HOME/.ssh/authorized_keys" "$ADMIN_PUBKEY" "$DEPLOY_USER"
    add_authorized_key /root/.ssh/authorized_keys "$ADMIN_PUBKEY" root
  fi
}

create_directories() {
  echo "bootstrap: $DEPLOY_ROOT"
  # deploy.sh reads env/<stack>.env; Traefik mounts secrets/ read-only (infra/proxy);
  # the workflow rsyncs infra/ with --delete as the deploy user, so it must own the tree.
  local dir
  for dir in "$DEPLOY_ROOT" "$DEPLOY_ROOT/infra"; do
    mkdir -p "$dir"
    chmod 755 "$dir"
  done
  for dir in "$DEPLOY_ROOT/env" "$DEPLOY_ROOT/secrets"; do
    mkdir -p "$dir"
    chmod 700 "$dir"
  done
  chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_ROOT" "$DEPLOY_ROOT/env" "$DEPLOY_ROOT/secrets"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_ROOT/infra"
}

create_env_file() {
  echo "bootstrap: $ENV_FILE"
  if [ -f "$ENV_FILE" ]; then
    # It holds the live TAG and the database password: never regenerated.
    echo "bootstrap: env file exists, left as it is"
    [ "$(env_get "$ENV_FILE" STACK)" = "$STACK" ] || warn "STACK in $ENV_FILE is not $STACK; deploy.sh will refuse it"
    [ "$(env_get "$ENV_FILE" SITE_HOST)" = "$SITE_HOST" ] || warn "SITE_HOST in $ENV_FILE is $(env_get "$ENV_FILE" SITE_HOST), not $SITE_HOST; the file wins"
    chmod 600 "$ENV_FILE"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
    return 0
  fi
  local postgres_password
  postgres_password="$(openssl rand -hex 24)"
  (
    umask 077
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  )
  env_set "$ENV_FILE" STACK "$STACK"
  env_set "$ENV_FILE" SITE_HOST "$SITE_HOST"
  env_set "$ENV_FILE" APP_ORIGIN "$APP_ORIGIN"
  env_set "$ENV_FILE" ACME_EMAIL "$ACME_EMAIL"
  # Where this script put things, which is the example's value unless DEPLOY_ROOT moved.
  env_set "$ENV_FILE" APP_ENV_FILE "$ENV_FILE"
  env_set "$ENV_FILE" TRAEFIK_SECRETS_DIR "$DEPLOY_ROOT/secrets"
  env_set "$ENV_FILE" POSTGRES_PASSWORD "$postgres_password"
  # Env files do not expand variables, so the same password goes into the URL.
  env_set "$ENV_FILE" DATABASE_URL "$(env_get "$ENV_FILE" DATABASE_URL | sed "s|<POSTGRES_PASSWORD>|$postgres_password|")"
  env_set "$ENV_FILE" AUTH_SECRET "$(openssl rand -base64 32)"
  env_set "$ENV_FILE" REVALIDATE_SECRET "$(openssl rand -base64 32)"
  if [ "$STACK" = "staging" ]; then
    # deploy.sh's smoke test signs in with this; it must match the users file below.
    env_set "$ENV_FILE" SMOKE_BASIC_AUTH "$STAGING_BASIC_AUTH"
  fi
  chmod 600 "$ENV_FILE"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
  echo "bootstrap: generated POSTGRES_PASSWORD, AUTH_SECRET and REVALIDATE_SECRET"
}

create_staging_htpasswd() {
  [ "$STACK" = "staging" ] || return 0
  echo "bootstrap: $HTPASSWD_FILE"
  local user="${STAGING_BASIC_AUTH%%:*}" password="${STAGING_BASIC_AUTH#*:}"
  if [ -f "$HTPASSWD_FILE" ]; then
    # Kept: the live staging credential. Only check that the input still matches it,
    # because SMOKE_BASIC_AUTH in a new env file would otherwise fail the smoke test.
    if ! htpasswd -vb "$HTPASSWD_FILE" "$user" "$password" >/dev/null 2>&1; then
      warn "STAGING_BASIC_AUTH does not match the existing $HTPASSWD_FILE, which was kept"
    fi
  else
    (
      umask 077
      htpasswd -nbB "$user" "$password" > "$HTPASSWD_FILE"
    )
  fi
  chmod 600 "$HTPASSWD_FILE"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$HTPASSWD_FILE"
}

configure_swap() {
  echo "bootstrap: swap"
  # The stack's memory limits (1g web, 768m api, 512m worker, plus Postgres, Redis and
  # Traefik) sit close to a 4 GB box's ceiling. Swap turns a spike into slowness instead
  # of an OOM kill; low swappiness keeps it for that and not for everyday paging.
  if [ -z "$(swapon --noheadings --show=NAME)" ]; then
    if [ ! -f /swapfile ]; then
      fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
      chmod 600 /swapfile
    fi
    [ "$(blkid -o value -s TYPE /swapfile 2>/dev/null || true)" = "swap" ] || mkswap -q /swapfile
    swapon /swapfile
  fi
  if [ -f /swapfile ] && ! grep -qE '^/swapfile[[:space:]]' /etc/fstab; then
    printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
  fi
  if write_file /etc/sysctl.d/60-calwebtech.conf 644 <<'EOF'
vm.swappiness = 10
EOF
  then :; fi
  sysctl -q -p /etc/sysctl.d/60-calwebtech.conf
}

ufw_allow() {
  # `ufw status` lists nothing while the firewall is inactive; `ufw show added` lists
  # the rules whatever the state.
  local added
  added="$(ufw show added 2>/dev/null || true)"
  if ! grep -qxF "ufw allow $1" <<< "$added"; then
    ufw allow "$1" >/dev/null
  fi
}
configure_firewall() {
  echo "bootstrap: firewall"
  # Docker publishes ports through its own iptables chains, past UFW. That is fine only
  # because the compose files publish 80 and 443 alone, both allowed here; Postgres and
  # Redis stay on the internal network and must never gain a ports: entry.
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  if [ "$SSH_PORT" = "22" ]; then
    ufw_allow OpenSSH
  else
    ufw_allow "$SSH_PORT/tcp"
  fi
  ufw_allow 80/tcp
  ufw_allow 443/tcp
  local status
  status="$(ufw status 2>/dev/null || true)"
  if ! grep -q '^Status: active' <<< "$status"; then
    ufw --force enable >/dev/null
  fi
}

configure_fail2ban() {
  echo "bootstrap: fail2ban"
  # Ubuntu 24.04 has no /var/log/auth.log unless rsyslog is installed; the journal
  # backend reads sshd's logs either way.
  if write_file /etc/fail2ban/jail.d/50-calwebtech.conf 644 <<EOF
[sshd]
enabled = true
port = $SSH_PORT
backend = systemd
EOF
  then
    systemctl restart fail2ban
  fi
  systemctl enable --now fail2ban >/dev/null 2>&1
}

harden_sshd() {
  echo "bootstrap: sshd"
  # Keys only. Root keeps key access as the break-glass path: prohibit-password, never
  # no. Cloud images ship 50-cloud-init.conf with PasswordAuthentication yes; sshd takes
  # the first value it reads and sorts the drop-ins by name, so 50-calwebtech wins. The
  # effective value is checked below rather than assumed.
  local dropin=/etc/ssh/sshd_config.d/50-calwebtech.conf previous="" existed=false
  [ -d /etc/ssh/sshd_config.d ] || die "/etc/ssh/sshd_config.d does not exist; sshd_config has no Include on this box"
  if [ -f "$dropin" ]; then
    existed=true
    previous="$(cat "$dropin")"
  fi
  if write_file "$dropin" 644 <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
EOF
  then
    if ! sshd -t; then
      # Put back what was there so the running configuration and the file agree.
      if [ "$existed" = "true" ]; then
        printf '%s\n' "$previous" > "$dropin"
      else
        rm -f "$dropin"
      fi
      die "sshd rejected the hardened configuration; nothing was reloaded"
    fi
    systemctl reload-or-restart ssh
  fi
  local effective
  effective="$(sshd -T 2>/dev/null | awk '$1 == "passwordauthentication" { print $2; exit }' || true)"
  if [ "$effective" != "no" ]; then
    die "PasswordAuthentication is still ${effective:-unset}; another file in /etc/ssh/sshd_config.d sets it first: $(grep -lis '^PasswordAuthentication' /etc/ssh/sshd_config.d/*.conf | tr '\n' ' ')"
  fi
}

configure_unattended_upgrades() {
  echo "bootstrap: unattended security upgrades"
  # Ubuntu's 50unattended-upgrades already limits itself to the security pocket; this is
  # what dpkg-reconfigure writes to turn the timers on. Kernel updates still wait for a
  # reboot that nothing here schedules.
  if write_file /etc/apt/apt.conf.d/20auto-upgrades 644 <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
  then :; fi
  systemctl enable --now unattended-upgrades >/dev/null 2>&1
}

configure_time_sync() {
  echo "bootstrap: time sync"
  # Let's Encrypt refuses a clock that is off, and the backup names are timestamps.
  if systemctl is-active --quiet chrony 2>/dev/null || systemctl is-active --quiet chronyd 2>/dev/null; then
    echo "bootstrap: chrony is active, leaving it"
    return 0
  fi
  apt_install systemd-timesyncd
  if [ "$(timedatectl show -p NTP --value 2>/dev/null || true)" != "yes" ]; then
    timedatectl set-ntp true
  fi
  systemctl enable --now systemd-timesyncd >/dev/null 2>&1
}

# ---- the hand-over

public_ip() {
  local ip
  ip="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  printf '%s\n' "$ip"
}

# The known_hosts entry the CI pins, keyed by the host it connects to, never 127.0.0.1.
# Comment lines are skipped because ssh-keyscan's banner goes to stdout from OpenSSH 10
# on: without the filter awk reads that instead of the key, and pins a line with no key
# in it, which fails every deploy at host verification.
known_hosts_line() {
  local host="$1" key
  key="$(ssh-keyscan -p "$SSH_PORT" -t ed25519 127.0.0.1 2>/dev/null | awk '!/^#/ {print $2, $3; exit}' || true)"
  if [ -z "$key" ] && [ -r /etc/ssh/ssh_host_ed25519_key.pub ]; then
    key="$(awk '{print $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub)"
  fi
  [ -n "$key" ] || die "could not read the server's ed25519 host key"
  if [ "$SSH_PORT" = "22" ]; then
    printf '%s %s\n' "$host" "$key"
  else
    printf '[%s]:%s %s\n' "$host" "$SSH_PORT" "$key"
  fi
}

summary() {
  local ip empty
  ip="$(public_ip)"
  empty="$(grep -E '^[A-Za-z_][A-Za-z0-9_]*=("")?$' "$ENV_FILE" | cut -d= -f1 || true)"
  echo
  echo "bootstrap: done. The server is ready for the release workflow."
  echo
  echo "==== GitHub: settings > Environments > $STACK > secrets ===="
  echo "VPS_HOST=$ip"
  echo "VPS_PORT=$SSH_PORT"
  echo "VPS_USER=$DEPLOY_USER"
  echo "VPS_KNOWN_HOSTS=$(known_hosts_line "$ip")"
  echo
  echo "The known_hosts entry is keyed by VPS_HOST. If you set VPS_HOST to a DNS name"
  echo "instead of the address, use the same name in VPS_KNOWN_HOSTS."
  echo
  echo "==== Remaining steps, in order ===="
  echo "1. Fill the empty keys in $ENV_FILE (owner $DEPLOY_USER, mode 600):"
  if [ -n "$empty" ]; then
    printf '%s\n' "$empty" | sed 's/^/     /'
  else
    echo "     (none)"
  fi
  echo "   TAG stays empty until deploy.sh records the first release that passed."
  echo "2. Point DNS: an A record for $SITE_HOST to $ip. Let's Encrypt validates over"
  echo "   port 80, so the name must resolve here before the first deploy."
  echo "3. Add the four secrets above to the GitHub environment \"$STACK\". While the"
  echo "   GHCR packages are private, also GHCR_PULL_USER and GHCR_PULL_TOKEN (read:packages)."
  if [ "$STACK" = "staging" ]; then
    echo "   Set the repository variable STAGING_URL to $APP_ORIGIN."
    echo "4. Set the repository variable DEPLOY_ENABLED to true. The next push to main deploys."
  else
    echo "   Set the repository variable PRODUCTION_URL to $APP_ORIGIN."
    echo "4. Production never deploys on push. Actions > release > Run workflow, stack"
    echo "   \"production\", tag = the commit SHA on main whose images passed verify."
  fi
}

preflight
install_base_packages
configure_docker_daemon
install_docker
create_deploy_user
create_directories
create_env_file
create_staging_htpasswd
configure_swap
configure_firewall
configure_fail2ban
harden_sshd
configure_unattended_upgrades
configure_time_sync
summary
