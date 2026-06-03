import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPlaybook } from '@/lib/playbooks'
import { PlaybookDetail } from '@/components/playbook/playbook-detail'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const pb = getPlaybook(slug)
  return { title: pb ? pb.title : 'Playbook' }
}

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const pb = getPlaybook(slug)
  if (!pb) notFound()
  return <PlaybookDetail playbook={pb} />
}
