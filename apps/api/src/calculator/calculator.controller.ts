import type { CalculatorPageView } from '@calwebtech/shared';
import { Controller, Get, Module } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CalculatorPageService } from './calculator.service';

/**
 * `/cost-calculator/`. Not rate limited: every render calls this from the web server's
 * single address, and repeated calls are served from the service's short cache.
 *
 * The calculator's submissions go to `POST /leads` with `type: "CALCULATOR"`, where the API
 * recomputes the range from the answers (apps/api/src/leads, calculator-lead.ts).
 */
@Controller('pages/cost-calculator')
export class CalculatorPageController {
  constructor(private readonly page: CalculatorPageService) {}

  @Get()
  @SkipThrottle()
  find(): Promise<CalculatorPageView> {
    return this.page.find();
  }
}

@Module({ controllers: [CalculatorPageController], providers: [CalculatorPageService] })
export class CalculatorPageModule {}
