'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Leaf renderer markdown riset AI — dipisah dari research-tabs supaya
 * react-markdown + remark-gfm (±232KB, marker micromark) TIDAK ikut eager di
 * route research; dimuat via next/dynamic saat body riset benar-benar tampil.
 */
export function ResearchMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Tabel markdown (mis. "Highlights Finansial — Tren 5 Tahun") bisa
        // 6-7 kolom: bungkus scroll horizontal + edge-fade di mobile biar
        // kolom terakhir gak keiris diam-diam.
        table: (props) => {
          const { node, ...tableProps } = props
          void node
          return (
            <div className="md-table-scroll">
              <table {...tableProps} />
            </div>
          )
        },
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
