import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMemory } from './okmeter'

const frame = (body: string) =>
  Buffer.concat([Buffer.from([0x01]), Buffer.from('Glucose\r\n'), Buffer.from([0x02]), Buffer.from(body), Buffer.from([0x03, 0x04])])

test('interpreta registros do OK Meter Match II', () => {
  const r = parseMemory(frame('1,2027,11,13,09,10,150,mg_dL,0\n2,2027,11,13,07,05,172,mg_dL,1\n'))
  assert.equal(r.length, 2)
  assert.deepEqual(r[0], { index: 1, device_measured_at: '2027-11-13T09:10', value_mg_dl: 150, meal_tag: 0 })
  assert.equal(r[1].meal_tag, 1)
})

test('aceita campos extras no fim do registro (",D")', () => {
  const r = parseMemory(frame('1,2027,11,13,12,30,140,mg_dL,0,D\r\n'))
  assert.deepEqual(r[0], { index: 1, device_measured_at: '2027-11-13T12:30', value_mg_dl: 140, meal_tag: 0 })
})

test('mensagem vazia significa memória vazia', () => {
  assert.deepEqual(parseMemory(frame('')), [])
})

test('converte mmol/L para mg/dL', () => {
  const r = parseMemory(frame('1,2026,01,02,03,04,5.5,mmol_L,0\n'))
  assert.equal(r[0].value_mg_dl, 99)
})

test('rejeita resposta sem cabeçalho ou incompleta', () => {
  assert.throws(() => parseMemory(Buffer.from('lixo')), /cabeçalho/)
  assert.throws(() => parseMemory(frame('1,2026,01,02,03,04,100,mg_dL,0\n').subarray(0, -1)), /parou de responder/)
})
