import type { ClinicVisit, ClinicLabOrder, ClinicLabOrderItem, ClinicHospitalization, ClinicDailyObservation, Prescription } from '@/types'
import dayjs from 'dayjs'

// ── Shared styles for A4 medical documents ──────────────────────

const MEDICAL_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 30px 40px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
  .header { border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .header .clinic { font-size: 11px; color: #555; margin-top: 2px; }
  .patient-info { background: #f7f7f7; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; display: flex; gap: 24px; flex-wrap: wrap; }
  .patient-info .field { font-size: 12px; }
  .patient-info .label { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .patient-info .value { font-weight: 600; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
  .section-body { font-size: 13px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
  th { background: #f0f0f0; padding: 6px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #ddd; }
  td { padding: 6px 10px; border: 1px solid #ddd; }
  .flag-normal { color: #16a34a; font-weight: 600; }
  .flag-low { color: #d97706; font-weight: 600; }
  .flag-high { color: #dc2626; font-weight: 600; }
  .flag-abnormal { color: #7c3aed; font-weight: 600; }
  .footer { border-top: 1px solid #ccc; margin-top: 24px; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #666; }
  .signature { margin-top: 40px; display: flex; justify-content: space-between; }
  .signature .line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 4px; font-size: 11px; color: #555; }
  @media print { body { padding: 10px 20px; } }
`

function openPrintWindow(title: string, html: string) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>${title}</title><style>${MEDICAL_CSS}</style></head><body>${html}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 600)
}

function patientBlock(name: string, dob?: string | null, extra?: Record<string, string | undefined>) {
  let fields = `<div class="field"><span class="label">Пациент</span><br><span class="value">${name}</span></div>`
  if (dob) fields += `<div class="field"><span class="label">Дата рождения</span><br><span class="value">${dayjs(dob).format('DD.MM.YYYY')}</span></div>`
  if (extra) {
    for (const [label, value] of Object.entries(extra)) {
      if (value) fields += `<div class="field"><span class="label">${label}</span><br><span class="value">${value}</span></div>`
    }
  }
  return `<div class="patient-info">${fields}</div>`
}

function signatureBlock(doctorName: string) {
  return `<div class="signature"><div class="line">Дата: ${dayjs().format('DD.MM.YYYY')}</div><div class="line">Врач: ${doctorName}</div></div>`
}

// ── Print functions ─────────────────────────────────────────────

/** Печать рецепта */
export function printPrescription(
  prescriptions: Prescription[],
  patient: { name: string; dob?: string | null },
  masterName: string,
) {
  if (!prescriptions.length) return

  const rows = prescriptions.map((p, i) =>
    `<tr><td>${i + 1}</td><td><b>${p.name}</b></td><td>${p.dosage}</td><td>${p.frequency}</td><td>${p.duration}</td></tr>`
  ).join('')

  const html = `
    <div class="header"><h1>Рецепт</h1><p class="clinic">${masterName}</p></div>
    ${patientBlock(patient.name, patient.dob)}
    <table>
      <thead><tr><th>#</th><th>Препарат</th><th>Дозировка</th><th>Частота</th><th>Длительность</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${signatureBlock(masterName)}
  `
  openPrintWindow('Рецепт', html)
}

/** Печать результатов анализов */
export function printLabResults(
  order: { ordered_at: string; notes?: string | null },
  items: ClinicLabOrderItem[],
  patient: { name: string; dob?: string | null },
  masterName: string,
) {
  const flagClass = (f?: string | null) => f ? `flag-${f}` : ''
  const flagLabel = (f?: string | null) => {
    if (!f) return ''
    const labels: Record<string, string> = { normal: 'Норма', low: 'Ниже', high: 'Выше', abnormal: 'Откл.' }
    return labels[f] || ''
  }

  const rows = items.map(item => `
    <tr>
      <td>${item.test_name}</td>
      <td><b>${item.result_value || '—'}</b> ${item.result_unit || ''}</td>
      <td>${item.ref_min != null || item.ref_max != null ? `${item.ref_min ?? '...'} – ${item.ref_max ?? '...'}` : item.ref_text || '—'}</td>
      <td class="${flagClass(item.flag)}">${flagLabel(item.flag)}</td>
    </tr>
  `).join('')

  const html = `
    <div class="header"><h1>Результаты анализов</h1><p class="clinic">${masterName}</p></div>
    ${patientBlock(patient.name, patient.dob, { 'Дата направления': dayjs(order.ordered_at).format('DD.MM.YYYY') })}
    <table>
      <thead><tr><th>Анализ</th><th>Результат</th><th>Референс</th><th>Оценка</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${order.notes ? `<div class="section"><div class="section-title">Примечания</div><div class="section-body">${order.notes}</div></div>` : ''}
    ${signatureBlock(masterName)}
  `
  openPrintWindow('Результаты анализов', html)
}

/** Печать выписного эпикриза */
export function printDischargeSummary(
  hosp: ClinicHospitalization,
  observations: ClinicDailyObservation[],
  patient: { name: string; dob?: string | null },
  masterName: string,
) {
  const obsRows = observations.slice(0, 10).map(o => `
    <tr>
      <td>${dayjs(o.observation_date).format('DD.MM')}</td>
      <td>${o.temperature ?? '—'}</td>
      <td>${o.bp_systolic && o.bp_diastolic ? `${o.bp_systolic}/${o.bp_diastolic}` : '—'}</td>
      <td>${o.pulse ?? '—'}</td>
      <td>${o.spo2 ?? '—'}</td>
      <td>${o.notes || '—'}</td>
    </tr>
  `).join('')

  const html = `
    <div class="header"><h1>Выписной эпикриз</h1><p class="clinic">${masterName}</p></div>
    ${patientBlock(patient.name, patient.dob, {
      'Поступление': dayjs(hosp.admission_date).format('DD.MM.YYYY'),
      'Выписка': hosp.discharge_date ? dayjs(hosp.discharge_date).format('DD.MM.YYYY') : '—',
      'Лечащий врач': hosp.attending_doctor || undefined,
    })}
    ${hosp.diagnosis ? `<div class="section"><div class="section-title">Диагноз</div><div class="section-body">${hosp.diagnosis}${hosp.diagnosis_code ? ` (${hosp.diagnosis_code})` : ''}</div></div>` : ''}
    ${hosp.reason ? `<div class="section"><div class="section-title">Причина госпитализации</div><div class="section-body">${hosp.reason}</div></div>` : ''}
    ${observations.length > 0 ? `
      <div class="section"><div class="section-title">Наблюдения</div>
      <table><thead><tr><th>Дата</th><th>t°</th><th>АД</th><th>Пульс</th><th>SpO2</th><th>Примечания</th></tr></thead>
      <tbody>${obsRows}</tbody></table></div>
    ` : ''}
    ${hosp.discharge_summary ? `<div class="section"><div class="section-title">Эпикриз</div><div class="section-body">${hosp.discharge_summary}</div></div>` : ''}
    ${signatureBlock(hosp.attending_doctor || masterName)}
  `
  openPrintWindow('Выписной эпикриз', html)
}

/** Печать записи приёма */
export function printVisitRecord(
  visit: ClinicVisit,
  patient: { name: string; dob?: string | null },
  masterName: string,
  appointmentDate?: string,
) {
  const sections = [
    { title: 'Жалобы', body: visit.complaints },
    { title: 'Осмотр', body: visit.examination },
    { title: 'Диагноз', body: `${visit.diagnosis || ''}${visit.diagnosis_code ? ` (${visit.diagnosis_code})` : ''}`.trim() || undefined },
    { title: 'Лечение', body: visit.treatment },
    { title: 'Рекомендации', body: visit.recommendations },
  ].filter(s => s.body).map(s =>
    `<div class="section"><div class="section-title">${s.title}</div><div class="section-body">${s.body}</div></div>`
  ).join('')

  let prescriptionsHtml = ''
  if (visit.prescriptions?.length) {
    const rows = visit.prescriptions.map((p, i) =>
      `<tr><td>${i + 1}</td><td><b>${p.name}</b></td><td>${p.dosage}</td><td>${p.frequency}</td><td>${p.duration}</td></tr>`
    ).join('')
    prescriptionsHtml = `
      <div class="section"><div class="section-title">Назначения</div>
      <table><thead><tr><th>#</th><th>Препарат</th><th>Дозировка</th><th>Частота</th><th>Длительность</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    `
  }

  const nextVisit = visit.next_visit_date
    ? `<div class="section"><div class="section-title">Повторный приём</div><div class="section-body">${dayjs(visit.next_visit_date).format('DD.MM.YYYY')}</div></div>`
    : ''

  const html = `
    <div class="header"><h1>Запись приёма</h1><p class="clinic">${masterName}</p></div>
    ${patientBlock(patient.name, patient.dob, appointmentDate ? { 'Дата приёма': dayjs(appointmentDate).format('DD.MM.YYYY') } : undefined)}
    ${sections}
    ${prescriptionsHtml}
    ${nextVisit}
    ${signatureBlock(masterName)}
  `
  openPrintWindow('Запись приёма', html)
}
