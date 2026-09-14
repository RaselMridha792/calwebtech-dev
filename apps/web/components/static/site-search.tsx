import { SITE_ROUTES, type StaticNotFoundView } from '@calwebtech/shared';

/**
 * Filters the pages listed on /sitemap/ by title and section as the visitor types. It is a
 * plain inline script rather than a client component: a not-found boundary is serialised
 * into the payload of every page in its segment, and a client component there would add its
 * chunk to every route's JavaScript. Marketing routes navigate with full page loads, so the
 * script runs whenever the 404 is shown. The index is fetched once, on first focus, from the
 * human-readable sitemap (each section's `h2` followed by its list of links).
 *
 * Without script the form submits to /sitemap/, which lists every page.
 */
const SEARCH_SCRIPT = `(function(s){var f=s&&s.previousElementSibling;if(!f||!window.fetch||!window.DOMParser)return;
var q=f.querySelector('input'),o=f.querySelector('[role=status]'),l=f.querySelector('ul'),p=[],w;
function load(){return w||(w=fetch(f.action,{credentials:'same-origin'}).then(function(r){return r.ok?r.text():''}).then(function(t){
new DOMParser().parseFromString(t,'text/html').querySelectorAll('main h2').forEach(function(h){var u=h.nextElementSibling;
if(u&&u.tagName==='UL')u.querySelectorAll('a[href]').forEach(function(a){p.push({t:a.textContent.trim(),h:a.getAttribute('href'),s:h.textContent.trim()})})})
}).catch(function(){}))}
function show(){var v=q.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);l.textContent='';
if(!v.length){l.hidden=true;o.textContent='';return}
var m=p.filter(function(x){var k=(x.t+' '+x.s).toLowerCase();return v.every(function(y){return k.indexOf(y)>-1})}).slice(0,8);
m.forEach(function(x){var i=document.createElement('li'),a=document.createElement('a'),n=document.createElement('span');a.href=x.h;a.textContent=x.t;n.textContent=x.s;i.append(a,n);l.append(i)});
l.hidden=!m.length;o.textContent=m.length?o.dataset.label+' '+m.length:o.dataset.none}
q.addEventListener('focus',load);q.addEventListener('input',function(){load().then(show)});
f.addEventListener('submit',function(e){var a=l.querySelector('a');if(a){e.preventDefault();a.focus()}})})(document.currentScript)`;

/** The not-found page's search: a labelled field, a live count and the matching pages. */
export function SiteSearch({ copy }: { copy: StaticNotFoundView['search'] }) {
  return (
    <>
      <form role="search" action={SITE_ROUTES.sitemap} method="get" className="mt-9 max-w-[560px]">
        <label htmlFor="site-search-query" className="block text-[14px] font-semibold text-ink">
          {copy.label}
        </label>
        <div className="mt-2 flex flex-wrap gap-2 sm:flex-nowrap">
          <input
            id="site-search-query"
            type="search"
            name="q"
            autoComplete="off"
            placeholder={copy.placeholder}
            aria-describedby="site-search-status"
            className="h-13 min-w-0 flex-1 basis-60 rounded-xl border border-line bg-white px-4 text-[16px] text-ink placeholder:text-body focus:border-primary"
          />
          <button
            type="submit"
            className="h-13 rounded-xl bg-primary px-6 text-[16px] font-semibold text-white hover:bg-primaryd"
          >
            {copy.submitLabel}
          </button>
        </div>
        <p
          id="site-search-status"
          role="status"
          data-label={copy.resultsLabel}
          data-none={copy.noResults}
          className="mt-3 min-h-6 text-[14px] empty:min-h-0"
        />
        <ul
          hidden
          className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white [&_a]:block [&_a]:px-4 [&_a]:pt-3 [&_a]:font-semibold [&_a]:text-ink [&_a:hover]:text-primary [&_span]:block [&_span]:px-4 [&_span]:pb-3 [&_span]:text-[13.5px]"
        />
      </form>
      <script dangerouslySetInnerHTML={{ __html: SEARCH_SCRIPT }} />
    </>
  );
}
