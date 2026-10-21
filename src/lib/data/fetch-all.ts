/**
 * PostgREST (Supabase) memotong hasil select di `max_rows` = 1000 baris TANPA
 * error. Query transaksi setahun / sepanjang masa yang langsung `await` bakal
 * diam-diam kehilangan baris begitu user lewat 1000 transaksi → total uang
 * salah (dashboard tahunan, realisasi anggaran, daftar transaksi).
 *
 * Helper ini menarik halaman `.range(from, to)` sampai halaman terakhir kurang
 * dari `pageSize`. Pemanggil WAJIB memberi urutan unik (mis. `.order('date')
 * .order('id')`) supaya halaman tidak tumpang-tindih / bolong.
 *
 *   const { data, error } = await fetchAllRows((from, to) =>
 *     supabase.from('transactions').select('id, amount').eq('user_id', uid)
 *       .order('date', { ascending: false }).order('id').range(from, to))
 */

type PageResult<T, E> = { data: T[] | null; error: E | null }

export const PAGE_SIZE = 1000

export async function fetchAllRows<T, E = unknown>(
  page: (from: number, to: number) => PromiseLike<PageResult<T, E>>,
  pageSize = PAGE_SIZE,
): Promise<{ data: T[]; error: E | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    // Halaman gagal = gagal semua: jangan kembalikan sebagian seolah lengkap.
    if (error) return { data: [], error }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) return { data: rows, error: null }
  }
}
