import { useState } from 'react'
import { Clock, Download, Smartphone } from 'lucide-react'
import {
  Button,
  buttonClasses,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Page,
  PageHeader,
  Skeleton,
} from '@/shared/design-system'
import { Can } from '@/app/guards/PermissionGuard'
import { Permission } from '@/shared/constants/permissions'
import { formatDateTime } from '@/shared/utils/format'
import { useGlucoseDevices, useUpdateDevice } from '../hooks/useGlucose'
import type { ClockPeriod, GlucoseDevice } from '../types'
import { fmt } from '../utils/glucose'

const MODEL_NAMES: Record<string, string> = {
  'okmeter-match-ii': 'OK Meter Match II',
}

function describeOffset(seconds: number): string {
  if (seconds === 0) return 'Sem ajuste'
  const abs = Math.abs(seconds)
  const days = Math.floor(abs / 86400)
  const hours = Math.floor((abs % 86400) / 3600)
  const minutes = Math.round((abs % 3600) / 60)
  const parts = [days && `${days} d`, hours && `${hours} h`, minutes && `${minutes} min`].filter(Boolean).join(' ')
  // offset negativo = o aparelho está adiantado (subtraímos tempo).
  return seconds < 0 ? `Aparelho adiantado ${parts}` : `Aparelho atrasado ${parts}`
}

function nowLocalInput(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function periodRange(period: ClockPeriod): string {
  if (!period.first || !period.last) return 'Sem medições'
  return `${fmt.full(period.first.measured_at)} → ${fmt.full(period.last.measured_at)}`
}

function ClockModal({ device, onClose }: { device: GlucoseDevice; onClose: () => void }) {
  const update = useUpdateDevice()
  const [shown, setShown] = useState('')
  const [name, setName] = useState(device.name ?? '')
  const [splitAt, setSplitAt] = useState('')
  const [splitDays, setSplitDays] = useState('')
  const periods = device.clock_periods
  const toDays = (seconds: number) => String(Math.round((seconds / 86400) * 100) / 100)
  const [periodDays, setPeriodDays] = useState(() => periods.map((p) => toDays(p.offset_seconds)))
  const periodsChanged = periodDays.some((v, i) => v !== toDays(periods[i].offset_seconds))

  // Diferença entre a hora real e a que a tela do aparelho mostra, arredondada ao minuto.
  const raw = shown ? Math.round((Date.now() - new Date(shown).getTime()) / 60000) * 60 : null
  const computed = raw === null ? null : Math.abs(raw) < 120 ? 0 : raw
  const done = { onSuccess: onClose }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Relógio do aparelho"
      description="As medições chegam com a data do relógio do aparelho. Quando ele está errado, guardamos a diferença por período e recalculamos os horários — a data original de cada medição continua salva."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { id: device.id, name: name || null, ...(computed === null ? {} : { clock_offset_seconds: computed }) },
                done,
              )
            }
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-6">
        <Field label="Nome do aparelho" htmlFor="device-name">
          <Input id="device-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={MODEL_NAMES[device.model] ?? device.model} />
        </Field>

        <section>
          <h3 className="text-sm font-semibold text-foreground">Períodos</h3>
          <p className="mt-0.5 text-[13px] text-muted">Diferença em dias: negativo = aparelho adiantado, positivo = atrasado.</p>
          <ol className="mt-2 divide-y divide-border rounded-md border border-border">
            {periods.map((period, i) => (
              <li key={period.from_sequence} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 text-sm">
                <span className="min-w-0 text-foreground">
                  {i === periods.length - 1 ? 'Atual' : `Período ${i + 1}`}
                  <span className="ml-2 text-xs text-subtle">{period.readings_count} medições · {periodRange(period)}</span>
                  <span className="block text-xs text-muted">{describeOffset(period.offset_seconds)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="any"
                    aria-label={`Diferença em dias do período ${i + 1}`}
                    className="h-9 w-28"
                    value={periodDays[i] ?? ''}
                    onChange={(e) => setPeriodDays((d) => d.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                  <span className="text-xs text-muted">dias</span>
                </span>
              </li>
            ))}
          </ol>
          {periodsChanged && (
            <Button
              size="sm"
              className="mt-2"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  {
                    id: device.id,
                    clock_offsets: periods.map((p, i) => ({
                      from_sequence: p.from_sequence,
                      offset_seconds: Math.round(Number(periodDays[i] || 0) * 86400),
                    })),
                  },
                  done,
                )
              }
            >
              Salvar diferenças dos períodos
            </Button>
          )}
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold text-foreground">Ajustar o período atual</h3>
          <Field label="Que data e hora o glicosímetro mostra agora?" htmlFor="device-now" hint="Ligue o aparelho e copie exatamente o que aparece na tela. Deixe vazio para manter o ajuste atual.">
            <div className="flex gap-2">
              <Input id="device-now" type="datetime-local" value={shown} onChange={(e) => setShown(e.target.value)} />
              <Button variant="ghost" size="sm" className="h-10 shrink-0" onClick={() => setShown(nowLocalInput())}>
                Agora
              </Button>
            </div>
          </Field>
          <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">
            {computed === null ? (
              <>Ajuste atual mantido: <span className="font-medium text-foreground">{describeOffset(periods[periods.length - 1]?.offset_seconds ?? 0)}</span></>
            ) : (
              <>Novo ajuste do período atual: <span className="font-medium text-foreground">{describeOffset(computed)}</span></>
            )}
          </p>
        </section>

        <section className="grid gap-2 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-foreground">Acertou o relógio no próprio aparelho?</h3>
          <p className="text-[13px] text-muted">
            Sincronize antes de acertar. Depois, clique aqui: as próximas medições passam a valer sem ajuste, e as antigas
            continuam corrigidas.
          </p>
          <div>
            <Button variant="secondary" size="sm" loading={update.isPending} onClick={() => update.mutate({ id: device.id, clock_fixed: true }, done)}>
              Acertei o relógio do aparelho agora
            </Button>
          </div>
        </section>

        <details className="border-t border-border pt-5 text-sm">
          <summary className="cursor-pointer font-semibold text-foreground">O relógio deu um salto no passado?</summary>
          <p className="mt-2 text-[13px] text-muted">
            Cria um novo período a partir da primeira medição cujo horário <em>no aparelho</em> é igual ou posterior ao
            informado, com a diferença em dias (negativo = aparelho adiantado).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
            <Field label="A partir de (horário do aparelho)" htmlFor="split-at">
              <Input id="split-at" type="datetime-local" value={splitAt} onChange={(e) => setSplitAt(e.target.value)} />
            </Field>
            <Field label="Diferença (dias)" htmlFor="split-days">
              <Input id="split-days" type="number" value={splitDays} onChange={(e) => setSplitDays(e.target.value)} placeholder="-364" />
            </Field>
            <Button
              variant="secondary"
              disabled={!splitAt || splitDays === ''}
              loading={update.isPending}
              onClick={() => update.mutate({ id: device.id, split_at_device_time: splitAt, split_offset_seconds: Math.round(Number(splitDays) * 86400) }, done)}
            >
              Criar período
            </Button>
          </div>
          {periods.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              loading={update.isPending}
              onClick={() => update.mutate({ id: device.id, clock_offsets: [{ from_sequence: 1, offset_seconds: periods[periods.length - 1].offset_seconds }] }, done)}
            >
              Juntar tudo num período só
            </Button>
          )}
        </details>
      </div>
    </Modal>
  )
}

function DeviceCard({ device, onEdit }: { device: GlucoseDevice; onEdit: () => void }) {
  const sync = device.last_sync_result
  const current = device.clock_periods[device.clock_periods.length - 1]

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-foreground">{device.name || MODEL_NAMES[device.model] || device.model}</h2>
          <p className="mt-0.5 text-xs text-subtle">
            {MODEL_NAMES[device.model] ?? device.model} · id {device.identifier}
          </p>
        </div>
        <Can permission={Permission.GLUCOSE_DEVICE_MANAGE}>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Clock className="size-4" />
            Relógio
          </Button>
        </Can>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <div className="border-t border-border pt-2">
          <dt className="text-xs text-muted">Medições</dt>
          <dd className="font-display text-2xl text-foreground">{fmt.number(device.readings_count ?? 0)}</dd>
        </div>
        <div className="border-t border-border pt-2">
          <dt className="text-xs text-muted">Última sincronização</dt>
          <dd className="mt-1 text-sm text-foreground">{device.last_synced_at ? formatDateTime(device.last_synced_at) : '—'}</dd>
        </div>
        <div className="border-t border-border pt-2">
          <dt className="text-xs text-muted">Resultado</dt>
          <dd className="mt-1 text-sm text-foreground">
            {sync ? `${sync.created} novas · ${sync.duplicates} já existiam` : '—'}
          </dd>
        </div>
        <div className="border-t border-border pt-2">
          <dt className="text-xs text-muted">Relógio (agora)</dt>
          <dd className="mt-1 text-sm text-foreground">{describeOffset(current?.offset_seconds ?? device.clock_offset_seconds)}</dd>
        </div>
      </dl>

      {device.clock_periods.length > 1 && (
        <div className="mt-5">
          <p className="text-xs text-muted">Períodos do relógio</p>
          <ol className="mt-1.5 space-y-1 text-[13px]">
            {device.clock_periods.map((period, i) => (
              <li key={period.from_sequence} className="flex flex-wrap gap-x-3 text-muted">
                <span className="font-medium text-foreground">{i + 1}.</span>
                <span>{periodRange(period)}</span>
                <span className="text-subtle">· {period.readings_count} medições · {describeOffset(period.offset_seconds)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  )
}

const APP_DOWNLOAD_URL = 'https://github.com/lucaskaiut/glicemia/releases/latest/download/Glicemia-Setup.exe'

function ReaderSetup() {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-medium text-foreground">Aplicativo para o computador</h2>
      <p className="mt-0.5 text-[13px] text-muted">
        O app Glicemia fica perto do relógio do Windows: quando você liga o glicosímetro no cabo USB, ele lê a memória do
        aparelho e envia só as medições novas para a sua conta.
      </p>

      <ol className="mt-5 space-y-5 text-sm">
        <li className="grid grid-cols-[2rem_1fr] gap-2">
          <span className="font-display text-xl text-accent">1</span>
          <div>
            <p className="font-medium text-foreground">Baixe e instale o app</p>
            <p className="mt-0.5 text-muted">
              Windows 10 ou 11. Como o app ainda não tem assinatura digital, o Windows pode mostrar um aviso: clique em{' '}
              <em>Mais informações → Executar assim mesmo</em>.
            </p>
            <a href={APP_DOWNLOAD_URL} className={buttonClasses('primary', 'sm', 'mt-2')}>
              <Download className="size-4" />
              Baixar o Glicemia para Windows
            </a>
          </div>
        </li>
        <li className="grid grid-cols-[2rem_1fr] gap-2">
          <span className="font-display text-xl text-accent">2</span>
          <div>
            <p className="font-medium text-foreground">Clique em “Conectar à minha conta”</p>
            <p className="mt-0.5 text-muted">
              O navegador abre nesta conta e pede sua permissão. O app só consegue <strong>enviar</strong> medições —
              não lê os seus dados.
            </p>
          </div>
        </li>
        <li className="grid grid-cols-[2rem_1fr] gap-2">
          <span className="font-display text-xl text-accent">3</span>
          <div>
            <p className="font-medium text-foreground">Ligue o glicosímetro no cabo USB</p>
            <p className="mt-0.5 text-muted">
              Com o aparelho desligado (a tela mostra <strong>USb</strong>). Em uns 20 segundos as medições aparecem aqui.
            </p>
          </div>
        </li>
      </ol>
    </Card>
  )
}

export default function DevicesPage() {
  const query = useGlucoseDevices()
  const [editing, setEditing] = useState<GlucoseDevice | null>(null)

  return (
    <Page>
      <PageHeader title="Aparelhos" description="Glicosímetros que já enviaram medições e a configuração do leitor." />

      {query.isPending ? (
        <Skeleton className="h-40" />
      ) : query.data && query.data.length > 0 ? (
        query.data.map((device) => <DeviceCard key={device.id} device={device} onEdit={() => setEditing(device)} />)
      ) : (
        <Card>
          <EmptyState icon={Smartphone} title="Nenhum aparelho ainda" description="O glicosímetro aparece aqui depois da primeira sincronização do leitor." />
        </Card>
      )}

      <ReaderSetup />

      {editing && <ClockModal device={editing} onClose={() => setEditing(null)} />}
    </Page>
  )
}
