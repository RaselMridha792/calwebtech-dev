import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StaticPagesController } from './static.controller';
import type { StaticPagesService } from './static.service';

function controllerWith(overrides: Partial<Record<keyof StaticPagesService, unknown>> = {}) {
  const service = {
    thankYou: vi.fn(() => Promise.resolve({ type: 'contact' })),
    legal: vi.fn(() => Promise.resolve({ slug: 'terms' })),
    ...overrides,
  };
  return { controller: new StaticPagesController(service as unknown as StaticPagesService), service };
}

describe('StaticPagesController', () => {
  it('answers 404 for a thank-you type that does not exist, without asking the service', async () => {
    const { controller, service } = controllerWith();
    await expect(controller.thankYou('constructor')).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.thankYou('newsletter')).rejects.toBeInstanceOf(NotFoundException);
    expect(service.thankYou).not.toHaveBeenCalled();
  });

  it('answers 404 when the copy has no page for a known type', async () => {
    const { controller } = controllerWith({ thankYou: vi.fn(() => Promise.resolve(null)) });
    await expect(controller.thankYou('careers')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('serves a known thank-you type and legal page', async () => {
    const { controller, service } = controllerWith();
    await expect(controller.thankYou('contact')).resolves.toEqual({ type: 'contact' });
    await expect(controller.legal('terms')).resolves.toEqual({ slug: 'terms' });
    expect(service.legal).toHaveBeenCalledWith('terms');
  });

  it('answers 404 for a legal slug outside the legal set', () => {
    const { controller, service } = controllerWith();
    expect(() => controller.legal('pricing')).toThrow(NotFoundException);
    expect(service.legal).not.toHaveBeenCalled();
  });
});
