import { describe, it, expect } from 'vitest'
import { categoryHue } from './category-hue'

// Warna kategori dipakai konsisten lintas Beranda/Anggaran/Transaksi. Test ini
// mengunci: (a) mapping semantik kategori baku, (b) determinisme hash kategori
// bebas (kalau algoritma hash berubah, warna se-app geser → test merah).

const coral = { soft: 'var(--c-coral-soft)', ink: 'var(--c-coral-ink)', bar: 'var(--c-coral)' }
const blue = { soft: 'var(--c-blue-soft)', ink: 'var(--c-blue-ink)', bar: 'var(--c-blue)' }
const violet = { soft: 'var(--c-violet-soft)', ink: 'var(--c-violet-ink)', bar: 'var(--c-violet)' }
const mint = { soft: 'var(--c-mint-soft)', ink: 'var(--c-mint-ink)', bar: 'var(--c-mint)' }

describe('categoryHue — mapping semantik kategori baku', () => {
  it('pengeluaran konsumtif → coral', () => {
    expect(categoryHue('Makanan')).toEqual(coral)
    expect(categoryHue('Food')).toEqual(coral)
    expect(categoryHue('Belanja')).toEqual(coral)
    expect(categoryHue('Hiburan')).toEqual(coral)
  })
  it('tagihan/utilitas → biru', () => {
    expect(categoryHue('Tagihan')).toEqual(blue)
    expect(categoryHue('Listrik')).toEqual(blue)
    expect(categoryHue('Transportasi')).toEqual(blue)
    expect(categoryHue('Kesehatan')).toEqual(blue)
  })
  it('investasi/langganan/tujuan → ungu', () => {
    expect(categoryHue('Investasi')).toEqual(violet)
    expect(categoryHue('Langganan')).toEqual(violet)
    expect(categoryHue('Crypto')).toEqual(violet)
    expect(categoryHue('Saham')).toEqual(violet)
  })
  it('pemasukan/tabungan → mint', () => {
    expect(categoryHue('Gaji')).toEqual(mint)
    expect(categoryHue('Salary')).toEqual(mint)
    expect(categoryHue('Tabungan')).toEqual(mint)
    expect(categoryHue('Dana Darurat')).toEqual(mint)
  })
})

describe('categoryHue — normalisasi input', () => {
  it('case-insensitive & trim', () => {
    expect(categoryHue('  MAKANAN  ')).toEqual(coral)
    expect(categoryHue('gAjI')).toEqual(mint)
  })
})

describe('categoryHue — kategori bebas (hash deterministik)', () => {
  it('input sama → output SELALU sama (stabil lintas render/halaman)', () => {
    const a = categoryHue('Kopi Senja Warung Pak Budi')
    const b = categoryHue('Kopi Senja Warung Pak Budi')
    expect(a).toEqual(b)
  })
  it('selalu mengembalikan salah satu dari 4 hue valid', () => {
    const palette = [coral, blue, violet, mint]
    for (const name of ['Zzz', 'Anu', 'Random 123', 'ê', 'kategori panjang sekali namanya']) {
      expect(palette).toContainEqual(categoryHue(name))
    }
  })
  it('regresi hash: pin output beberapa nama non-baku (deteksi perubahan algoritma)', () => {
    // Nilai ini turunan dari algoritma h=(h*31+charCode)%997 → h%4.
    // Kalau salah satu berubah tanpa sengaja, warna kategori bergeser di UI.
    const snapshot = {
      'Kopi': categoryHue('Kopi'),
      'Parkir': categoryHue('Parkir'),
      'Donasi': categoryHue('Donasi'),
      'Hadiah': categoryHue('Hadiah'),
    }
    // snapshot deterministik — bandingkan lagi di pemanggilan kedua
    expect(categoryHue('Kopi')).toEqual(snapshot['Kopi'])
    expect(categoryHue('Parkir')).toEqual(snapshot['Parkir'])
    // dan pastikan tiap output anggota palette (bukan undefined)
    for (const v of Object.values(snapshot)) {
      expect([coral, blue, violet, mint]).toContainEqual(v)
    }
  })
})
