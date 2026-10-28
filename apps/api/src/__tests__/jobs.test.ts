import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ExecutionContext, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common'

vi.mock('@motek/database', () => ({
  prisma: { $connect: vi.fn(), $disconnect: vi.fn() },
  PrismaClient: vi.fn(),
}))

import { CronSecretGuard, CRON_SECRET_HEADER } from '../jobs/cron-secret.guard'
import { JobsController, JOB_NAMES } from '../jobs/jobs.controller'
import { getBackgroundJobsMode, intervalJobsEnabled } from '../jobs/background-jobs.config'
import { EmailQueueService } from '../infrastructure/services/EmailQueueService'

// ── CronSecretGuard ───────────────────────────────────────────────────────────

function ctxWithHeader(value?: string): ExecutionContext {
  const req = { headers: value === undefined ? {} : { [CRON_SECRET_HEADER]: value } }
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext
}

describe('CronSecretGuard', () => {
  afterEach(() => { delete process.env['CRON_SECRET'] })

  it('acepta el secreto correcto', () => {
    process.env['CRON_SECRET'] = 'secreto-de-prueba-123'
    expect(new CronSecretGuard().canActivate(ctxWithHeader('secreto-de-prueba-123'))).toBe(true)
  })

  it.each([undefined, '', 'otro-secreto', 'secreto-de-prueba-12'])('rechaza el secreto %j', (value) => {
    process.env['CRON_SECRET'] = 'secreto-de-prueba-123'
    expect(() => new CronSecretGuard().canActivate(ctxWithHeader(value))).toThrow(UnauthorizedException)
  })

  it('fail-closed: sin CRON_SECRET configurado rechaza todo', () => {
    expect(() => new CronSecretGuard().canActivate(ctxWithHeader(''))).toThrow(UnauthorizedException)
    expect(() => new CronSecretGuard().canActivate(ctxWithHeader('cualquiera'))).toThrow(UnauthorizedException)
  })
})

// ── JobsController ────────────────────────────────────────────────────────────

function makeController(overrides: { pollerEnabled?: boolean; failing?: string } = {}) {
  const fail = (name: string) => (overrides.failing === name ? vi.fn().mockRejectedValue(new Error('boom')) : vi.fn().mockResolvedValue(undefined))
  const deps = {
    vendeloOrderQueue: { processNext: fail('vendelo-orders') },
    emailQueue: { processNext: fail('emails') },
    poller: { isEnabled: () => overrides.pollerEnabled ?? true, tick: vi.fn().mockResolvedValue({ batchSize: 3 }) },
    wompi: { reconcile: fail('wompi-reconcile') },
    expired: { cancelExpiredOrders: fail('expired-orders') },
    wallet: { checkWalletBalance: fail('vendelo-wallet') },
  }
  const controller = new JobsController(
    deps.vendeloOrderQueue as never, deps.emailQueue as never, deps.poller as never,
    deps.wompi as never, deps.expired as never, deps.wallet as never,
  )
  return { controller, deps }
}

describe('JobsController', () => {
  it.each([
    ['vendelo-orders', 'vendeloOrderQueue', 'processNext'],
    ['emails', 'emailQueue', 'processNext'],
    ['shipments', 'poller', 'tick'],
    ['wompi-reconcile', 'wompi', 'reconcile'],
    ['expired-orders', 'expired', 'cancelExpiredOrders'],
    ['vendelo-wallet', 'wallet', 'checkWalletBalance'],
  ] as const)('%s ejecuta la tarea y espera a que termine', async (job, dep, method) => {
    const { controller, deps } = makeController()

    const res = await controller.run(job)

    expect((deps[dep] as Record<string, ReturnType<typeof vi.fn>>)[method]).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({ job, ok: true })
  })

  it('cubre exactamente las tareas declaradas', () => {
    expect(JOB_NAMES).toHaveLength(6)
  })

  it('devuelve el resultado del polling', async () => {
    const { controller } = makeController()
    await expect(controller.run('shipments')).resolves.toMatchObject({ result: { batchSize: 3 } })
  })

  it('respeta el kill switch del polling (VENDELO_POLL_ENABLED=false)', async () => {
    const { controller, deps } = makeController({ pollerEnabled: false })

    const res = await controller.run('shipments')

    expect(deps.poller.tick).not.toHaveBeenCalled()
    expect(res).toMatchObject({ ok: true, result: { skipped: 'VENDELO_POLL_ENABLED=false' } })
  })

  it('tarea desconocida → 404', async () => {
    const { controller } = makeController()
    await expect(controller.run('borrar-todo')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('si la tarea falla responde 500 para que Cloud Scheduler la registre como fallida', async () => {
    const { controller } = makeController({ failing: 'emails' })
    await expect(controller.run('emails')).rejects.toBeInstanceOf(InternalServerErrorException)
  })
})

// ── Modo de ejecución ─────────────────────────────────────────────────────────

describe('BACKGROUND_JOBS_MODE', () => {
  afterEach(() => {
    delete process.env['BACKGROUND_JOBS_MODE']
    vi.useRealTimers()
  })

  it('por defecto es interval (comportamiento previo, desarrollo local)', () => {
    expect(getBackgroundJobsMode()).toBe('interval')
    expect(intervalJobsEnabled()).toBe(true)
  })

  it('rechaza valores inválidos', () => {
    process.env['BACKGROUND_JOBS_MODE'] = 'cron'
    expect(() => getBackgroundJobsMode()).toThrow('BACKGROUND_JOBS_MODE inválido')
  })

  describe('los servicios no programan timers en modo scheduler', () => {
    beforeEach(() => { vi.useFakeTimers() })

    it('EmailQueueService: interval programa el timer, scheduler no', () => {
      const prisma = { client: {} } as never
      const resend = {} as never

      const withTimer = new EmailQueueService(prisma, resend)
      withTimer.onModuleInit()
      expect(vi.getTimerCount()).toBe(1)
      withTimer.onModuleDestroy()

      process.env['BACKGROUND_JOBS_MODE'] = 'scheduler'
      new EmailQueueService(prisma, resend).onModuleInit()
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
