import { describe, it, expect } from 'vitest'
import { PLAYBOOKS, getPlaybook } from './playbooks'

const PREFILL = new Set(['monthlyExpense', 'monthlyIncome', 'liquidSavings'])
const TYPES = new Set(['number', 'select'])

describe('getPlaybook', () => {
  it('ketemu by slug', () => {
    expect(getPlaybook('dana-darurat')?.title).toBe('Dana Darurat')
  })
  it('slug tak dikenal → undefined', () => {
    expect(getPlaybook('ngaco')).toBeUndefined()
  })
})

describe('PLAYBOOKS — integritas data', () => {
  it('ada minimal satu playbook', () => {
    expect(PLAYBOOKS.length).toBeGreaterThan(0)
  })

  it('slug unik (gak ada duplikat)', () => {
    const slugs = PLAYBOOKS.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('tiap playbook punya field wajib & minimal 1 step + 1 input', () => {
    for (const p of PLAYBOOKS) {
      expect(p.slug, p.slug).toBeTruthy()
      expect(p.title, p.slug).toBeTruthy()
      expect(p.tagline, p.slug).toBeTruthy()
      expect(p.iconKey, p.slug).toBeTruthy()
      expect(p.intro, p.slug).toBeTruthy()
      expect(p.accent, p.slug).toMatch(/^var\(--/) // token warna, bukan hex liar
      expect(p.steps.length, p.slug).toBeGreaterThan(0)
      expect(p.inputs.length, p.slug).toBeGreaterThan(0)
    }
  })

  it('tiap step punya title + detail', () => {
    for (const p of PLAYBOOKS) {
      for (const s of p.steps) {
        expect(s.title, p.slug).toBeTruthy()
        expect(s.detail, p.slug).toBeTruthy()
      }
    }
  })

  it('tiap input: key+label terisi, type valid, key unik dalam playbook', () => {
    for (const p of PLAYBOOKS) {
      const keys = p.inputs.map((i) => i.key)
      expect(new Set(keys).size, `${p.slug} duplikat key`).toBe(keys.length)
      for (const f of p.inputs) {
        expect(f.key, p.slug).toBeTruthy()
        expect(f.label, p.slug).toBeTruthy()
        expect(TYPES.has(f.type), `${p.slug}.${f.key} type=${f.type}`).toBe(true)
      }
    }
  })

  it('input select selalu punya opsi (value+label terisi)', () => {
    for (const p of PLAYBOOKS) {
      for (const f of p.inputs.filter((i) => i.type === 'select')) {
        expect(f.options, `${p.slug}.${f.key}`).toBeDefined()
        expect(f.options!.length, `${p.slug}.${f.key}`).toBeGreaterThan(0)
        for (const o of f.options!) {
          expect(o.value, `${p.slug}.${f.key}`).toBeTruthy()
          expect(o.label, `${p.slug}.${f.key}`).toBeTruthy()
        }
      }
    }
  })

  it('prefillFrom (kalau diset) hanya pakai sumber yang dikenal', () => {
    for (const p of PLAYBOOKS) {
      for (const f of p.inputs) {
        if (f.prefillFrom) expect(PREFILL.has(f.prefillFrom), `${p.slug}.${f.key}`).toBe(true)
      }
    }
  })

  it('related.href (kalau ada) adalah path internal', () => {
    for (const p of PLAYBOOKS) {
      if (p.related) expect(p.related.href.startsWith('/'), p.slug).toBe(true)
    }
  })
})
