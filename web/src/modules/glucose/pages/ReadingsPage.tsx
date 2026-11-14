import { useState } from 'react'
import { ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  Page,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  type Column,
} from '@/shared/design-system'
import { Can } from '@/app/guards/PermissionGuard'
import { Permission } from '@/shared/constants/permissions'
import { usePermissions } from '@/shared/hooks/usePermissions'
import { isApiError } from '@/shared/api/errors'
import { RangeBadge } from '../components/RangeBadge'
import { useCreateReading, useDeleteReading, useGlucoseReadings, useUpdateReading } from '../hooks/useGlucose'
import type { GlucoseRange, GlucoseReading, MealTag, ReadingFilters } from '../types'
import { MEAL_LABELS, RANGE_META, RANGE_ORDER, fmt } from '../utils/glucose'

const RANGE_OPTIONS = RANGE_ORDER.map((r) => ({ value: r, label: RANGE_META[r].label }))
const MEAL_OPTIONS = (Object.keys(MEAL_LABELS) as MealTag[]).map((m) => ({ value: m, label: MEAL_LABELS[m] }))

function nowLocalInput(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function NewReadingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateReading()
  const [measuredAt, setMeasuredAt] = useState(nowLocalInput)
  const [value, setValue] = useState('')
  const [meal, setMeal] = useState<MealTag>('none')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    try {
      await create.mutateAsync({ measured_at: measuredAt, value_mg_dl: Number(value), meal_tag: meal, notes: notes || null })
      setValue('')
      setNotes('')
      onClose()
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova medição"
      description="Para medições feitas sem o glicosímetro conectado (ou em outro aparelho)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={create.isPending} disabled={!value}>Salvar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data e hora" htmlFor="measured_at" required>
          <Input id="measured_at" type="datetime-local" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} />
        </Field>
        <Field label="Glicose (mg/dL)" htmlFor="value" required error={error ?? undefined}>
          <Input id="value" type="number" inputMode="numeric" min={10} max={1000} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
        <Field label="Refeição" htmlFor="meal" className="sm:col-span-2">
          <Select id="meal" options={MEAL_OPTIONS} value={meal} onChange={(e) => setMeal(e.target.value as MealTag)} />
        </Field>
        <Field label="Observação" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Modal>
  )
}

function EditReadingModal({ reading, onClose }: { reading: GlucoseReading | null; onClose: () => void }) {
  const update = useUpdateReading()
  const [meal, setMeal] = useState<MealTag>(reading?.meal_tag ?? 'none')
  const [notes, setNotes] = useState(reading?.notes ?? '')

  if (!reading) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={`${reading.value_mg_dl} mg/dL`}
      description={fmt.full(reading.measured_at)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            loading={update.isPending}
            onClick={() => update.mutate({ id: reading.id, meal_tag: meal, notes: notes || null }, { onSuccess: onClose })}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Refeição" htmlFor="edit-meal">
          <Select id="edit-meal" options={MEAL_OPTIONS} value={meal} onChange={(e) => setMeal(e.target.value as MealTag)} />
        </Field>
        <Field label="Observação" htmlFor="edit-notes" hint="Ex.: o que comeu, atividade física, medicação.">
          <Textarea id="edit-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Modal>
  )
}

export default function ReadingsPage() {
  const { can } = usePermissions()
  const [filters, setFilters] = useState<ReadingFilters>({ page: 1, per_page: 25 })
  const query = useGlucoseReadings(filters)
  const remove = useDeleteReading()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<GlucoseReading | null>(null)
  const [deleting, setDeleting] = useState<GlucoseReading | null>(null)

  const setFilter = <K extends keyof ReadingFilters>(key: K, value: ReadingFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }))

  const columns: Array<Column<GlucoseReading>> = [
    {
      key: 'when',
      header: 'Quando',
      render: (r) => (
        <div>
          <span className="font-medium text-foreground">{fmt.weekday(r.measured_at)}</span>
          <span className="ml-2 text-muted">{fmt.time(r.measured_at)}</span>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Glicose',
      render: (r) => (
        <div className="flex items-baseline gap-3">
          <span className="w-12 text-right font-display text-xl text-foreground">{r.value_mg_dl}</span>
          <RangeBadge range={r.range} />
        </div>
      ),
    },
    {
      key: 'meal',
      header: 'Refeição',
      render: (r) => <span className="text-muted">{r.meal_tag === 'none' ? '—' : MEAL_LABELS[r.meal_tag]}</span>,
    },
    {
      key: 'notes',
      header: 'Observação',
      render: (r) => <span className="block max-w-56 truncate text-muted" title={r.notes ?? undefined}>{r.notes ?? '—'}</span>,
    },
    {
      key: 'source',
      header: 'Origem',
      render: (r) => (
        <span className="text-xs text-subtle" title={r.device_measured_at ? `Relógio do aparelho: ${fmt.full(r.device_measured_at)}` : undefined}>
          {r.source === 'manual' ? 'Manual' : (r.device?.name ?? 'Glicosímetro')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Ações</span>,
      className: 'w-20 text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {can(Permission.GLUCOSE_UPDATE) && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(r)} aria-label="Editar medição">
              <Pencil className="size-4" />
            </Button>
          )}
          {can(Permission.GLUCOSE_DELETE) && (
            <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} aria-label="Remover medição" className="text-danger hover:bg-danger-soft hover:text-danger">
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Medições"
        description="Todas as leituras, da mais recente para a mais antiga."
        actions={
          <Can permission={Permission.GLUCOSE_CREATE}>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Nova medição
            </Button>
          </Can>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="De" htmlFor="f-from">
          <Input id="f-from" type="date" value={filters.from ?? ''} onChange={(e) => setFilter('from', e.target.value)} />
        </Field>
        <Field label="Até" htmlFor="f-to">
          <Input id="f-to" type="date" value={filters.to ?? ''} onChange={(e) => setFilter('to', e.target.value)} />
        </Field>
        <Field label="Faixa" htmlFor="f-range">
          <Select id="f-range" placeholder="Todas" options={RANGE_OPTIONS} value={filters.range ?? ''} onChange={(e) => setFilter('range', e.target.value as GlucoseRange)} />
        </Field>
        <Field label="Refeição" htmlFor="f-meal">
          <Select id="f-meal" placeholder="Todas" options={MEAL_OPTIONS} value={filters.meal_tag ?? ''} onChange={(e) => setFilter('meal_tag', e.target.value as MealTag)} />
        </Field>
      </div>

      <Card className="overflow-hidden">
        <DataTable
          caption="Lista de medições de glicose"
          columns={columns}
          rows={query.data?.data ?? []}
          rowKey={(r) => r.id}
          loading={query.isPending}
          emptyState={<EmptyState icon={ListOrdered} title="Nenhuma medição encontrada" description="Ajuste os filtros ou conecte o glicosímetro." />}
        />
      </Card>

      {query.data?.meta && query.data.meta.last_page > 1 && (
        <Pagination meta={query.data.meta} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
      )}

      <NewReadingModal open={creating} onClose={() => setCreating(false)} />
      <EditReadingModal key={editing?.id} reading={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
        loading={remove.isPending}
        title="Remover medição"
        description={deleting ? `Remover a medição de ${deleting.value_mg_dl} mg/dL de ${fmt.full(deleting.measured_at)}? Se ela ainda estiver na memória do glicosímetro, será importada de novo na próxima sincronização.` : ''}
        confirmLabel="Remover"
      />
    </Page>
  )
}
