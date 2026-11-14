/**
 * Protocolo do OK Meter Match II (USB HID, VID 04D9 / PID B564).
 *
 * Por dentro o cabo é uma ponte USB→UART da Holtek em modo HID:
 *  1. Feature report configura a ponte para 57600 baud, 8N1.
 *  2. Output report [len=1, ENQ=0x05]: o aparelho responde uma mensagem vazia;
 *     em seguida [len=1, ACK=0x06]: ele envia a memória inteira.
 *  3. Input reports de 32 bytes: byte 0 = tamanho útil, depois os dados.
 *  4. A resposta é texto: SOH "Glucose" CR LF STX <registros> ETX EOT,
 *     um registro por linha: índice,ano,mês,dia,hora,min,valor,unidade,refeição
 */
import HID from 'node-hid'

export const VENDOR_ID = 0x04d9
export const PRODUCT_ID = 0xb564

const FEATURE_57600_8N1 = [0x00, 0x01, 0x00, 0xe1, 0x00, 0x00, 0x00, 0x00, 0x08]
const REPORT_SIZE = 33 // inclui o byte de report ID (0)
const HEADER = Buffer.from([0x01, ...Buffer.from('Glucose\r\n'), 0x02])
const TRAILER = Buffer.from([0x03, 0x04])
const ENQ = 0x05
const ACK = 0x06

const isComplete = (f: Buffer) => f.length >= HEADER.length + TRAILER.length && f.subarray(-2).equals(TRAILER)
const hasRecords = (f: Buffer) => isComplete(f) && f.length > HEADER.length + TRAILER.length
const logged = (f: Buffer, log: (msg: string) => void) => {
  log(`memória recebida: ${f.length} bytes`)
  return f
}

export interface MeterReading {
  index: number
  /** Hora local do relógio do aparelho, "YYYY-MM-DDTHH:mm". */
  device_measured_at: string
  value_mg_dl: number
  meal_tag: number
}

export interface MeterInfo {
  path: string
  serialNumber: string
}

export async function findMeter(): Promise<MeterInfo | null> {
  const devices = await HID.devicesAsync(VENDOR_ID, PRODUCT_ID)
  const dev = devices.find((d) => d.path)
  return dev ? { path: dev.path!, serialNumber: (dev.serialNumber ?? '').trim() } : null
}

export async function readMeterMemory(path: string, log: (msg: string) => void = () => {}): Promise<Buffer> {
  const device = await HID.HIDAsync.open(path)
  try {
    await device.sendFeatureReport(FEATURE_57600_8N1)

    const send = (byte: number) => {
      const report = Buffer.alloc(REPORT_SIZE)
      report[1] = 0x01 // tamanho
      report[2] = byte
      return device.write(report)
    }

    /** Lê uma mensagem inteira (até ETX EOT) ou o que chegar antes de 8s de silêncio. */
    const readFrame = async (): Promise<Buffer> => {
      const chunks: Buffer[] = []
      for (;;) {
        const report = await device.read(8000)
        if (!report || report.length === 0) break
        chunks.push(payloadOf(report))
        const data = Buffer.concat(chunks)
        if (data.length >= 2 && data.subarray(-2).equals(TRAILER)) break
      }
      return Buffer.concat(chunks)
    }

    // Protocolo: ENQ (0x05) → o aparelho responde uma mensagem de apresentação VAZIA
    // (cabeçalho + ETX EOT); ACK (0x06) → ele envia a memória inteira (~12s para 500 registros).
    let frame = Buffer.alloc(0)
    for (let round = 1; round <= 3; round++) {
      await send(ENQ)
      frame = await readFrame()
      if (hasRecords(frame)) return logged(frame, log)

      for (let ack = 1; ack <= 2; ack++) {
        await send(ACK)
        frame = await readFrame()
        if (hasRecords(frame)) return logged(frame, log)
      }

      log(`o aparelho não enviou a memória (rodada ${round}/3, ${frame.length} bytes)`)
    }

    if (frame.length === 0) throw new Error('O glicosímetro não respondeu. Confira se a tela mostra "USb" e conecte o cabo de novo.')
    if (isComplete(frame)) return frame // completa e sem registros = memória vazia
    throw new Error('O glicosímetro parou de responder no meio da leitura. Desconecte e conecte o cabo de novo.')
  } finally {
    await device.close().catch(() => {})
  }
}

/** Remove o report ID (se presente) e devolve só os bytes úteis do relatório. */
function payloadOf(report: Buffer): Buffer {
  const body = report.length === REPORT_SIZE ? report.subarray(1) : report
  const len = Math.min(body[0] ?? 0, body.length - 1)
  return body.subarray(1, 1 + len)
}

export function parseMemory(raw: Buffer): MeterReading[] {
  if (!raw.subarray(0, HEADER.length).equals(HEADER)) {
    throw new Error('Resposta inesperada do glicosímetro (cabeçalho inválido).')
  }
  if (!raw.subarray(-2).equals(TRAILER)) {
    throw new Error('O glicosímetro parou de responder no meio da leitura. Desconecte e conecte o cabo de novo.')
  }

  const text = raw.subarray(HEADER.length, -TRAILER.length).toString('latin1')
  const readings: MeterReading[] = []

  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(',')
    if (parts.length < 9) continue

    const [index, year, month, day, hour, minute, value, unit, meal] = parts
    let mgdl = Number(value)
    if (/mmol/i.test(unit)) mgdl = Math.round(Number(value) * 18.016)
    if (!Number.isFinite(mgdl) || mgdl <= 0) continue

    readings.push({
      index: Number(index),
      device_measured_at: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      value_mg_dl: mgdl,
      meal_tag: Number(meal) || 0,
    })
  }

  return readings
}
