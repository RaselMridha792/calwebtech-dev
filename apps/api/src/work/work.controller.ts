import {
  slugSchema,
  type WorkBeforeAndAfterView,
  type WorkCaseStudyView,
  type WorkIndexView,
} from '@calwebtech/shared';
import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkService } from './work.service';

/**
 * `/work/` and `/work/<slug>/`. Not rate limited: every render calls these from the web
 * server's one address, and repeated calls are served from the service's short cache.
 */
@Controller('pages/work')
@SkipThrottle()
export class WorkController {
  constructor(private readonly work: WorkService) {}

  @Get()
  findIndex(): Promise<WorkIndexView> {
    return this.work.findIndex();
  }

  @Get(':slug')
  async findCaseStudy(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string): Promise<WorkCaseStudyView> {
    const caseStudy = await this.work.findCaseStudy(slug);
    if (!caseStudy) throw new NotFoundException();
    return caseStudy;
  }
}

/** `/before-and-after/`. */
@Controller('pages/before-and-after')
@SkipThrottle()
export class BeforeAndAfterController {
  constructor(private readonly work: WorkService) {}

  @Get()
  find(): Promise<WorkBeforeAndAfterView> {
    return this.work.findBeforeAndAfter();
  }
}

@Module({ controllers: [WorkController, BeforeAndAfterController], providers: [WorkService] })
export class WorkModule {}
