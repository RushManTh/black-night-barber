'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type PromoFormValue = {
  name: string
  description: string
  code: string
  discount_type: 'percent' | 'fixed' | 'combo_price'
  discount_value: string
  min_amount_thb: string
  max_discount_thb: string
  valid_from: string
  valid_until: string
  max_total_uses: string
  max_uses_per_customer: string
  trigger_type: 'manual' | 'birthday' | 'first_visit' | 'loyalty'
  is_active: boolean
}

export function PromoForm({
  initial,
  onSubmit,
  cancelHref,
}: {
  initial: PromoFormValue
  onSubmit: (payload: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>
  cancelHref: string
}) {
  const router = useRouter()
  const [v, setV] = useState<PromoFormValue>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function set<K extends keyof PromoFormValue>(key: K, value: PromoFormValue[K]) {
    setV((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setErr(null)
    const payload: Record<string, unknown> = {
      name: v.name,
      description: v.description || null,
      code: v.code || null,
      discount_type: v.discount_type,
      discount_value: Number(v.discount_value),
      min_amount_thb: Number(v.min_amount_thb || 0),
      max_discount_thb: v.max_discount_thb ? Number(v.max_discount_thb) : null,
      valid_from: new Date(v.valid_from).toISOString(),
      valid_until: new Date(v.valid_until).toISOString(),
      max_total_uses: v.max_total_uses ? Number(v.max_total_uses) : null,
      max_uses_per_customer: Number(v.max_uses_per_customer || 1),
      trigger_type: v.trigger_type,
      is_active: v.is_active,
    }
    const result = await onSubmit(payload)
    setSubmitting(false)
    if (!result.ok) {
      setErr(result.error)
      return
    }
    router.push(cancelHref)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">ชื่อโปรโมชั่น *</Label>
        <Input id="name" value={v.name} onChange={(e) => set('name', e.target.value)} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="desc">รายละเอียด</Label>
        <Textarea id="desc" rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="code">รหัสคูปอง (ไม่ใส่ = ไม่ต้องกรอกตอนจอง)</Label>
        <Input
          id="code"
          value={v.code}
          onChange={(e) => set('code', e.target.value.toUpperCase())}
          placeholder="SUMMER50"
          className="font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>ประเภทส่วนลด</Label>
          <select
            value={v.discount_type}
            onChange={(e) => set('discount_type', e.target.value as PromoFormValue['discount_type'])}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm h-10"
          >
            <option value="percent">เปอร์เซ็นต์ (%)</option>
            <option value="fixed">ลดเงิน (฿)</option>
            <option value="combo_price">ราคารวม (฿)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dv">ค่า *</Label>
          <Input
            id="dv"
            type="number"
            min="0"
            value={v.discount_value}
            onChange={(e) => set('discount_value', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="min">ยอดขั้นต่ำ (฿)</Label>
          <Input id="min" type="number" min="0" value={v.min_amount_thb} onChange={(e) => set('min_amount_thb', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max">ส่วนลดสูงสุด (฿)</Label>
          <Input
            id="max"
            type="number"
            min="0"
            value={v.max_discount_thb}
            onChange={(e) => set('max_discount_thb', e.target.value)}
            placeholder="ไม่จำกัด"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="vf">เริ่มใช้ *</Label>
          <Input id="vf" type="datetime-local" value={v.valid_from} onChange={(e) => set('valid_from', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vu">สิ้นสุด *</Label>
          <Input id="vu" type="datetime-local" value={v.valid_until} onChange={(e) => set('valid_until', e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mt">ใช้รวมได้ทั้งหมด (ครั้ง)</Label>
          <Input
            id="mt"
            type="number"
            min="0"
            value={v.max_total_uses}
            onChange={(e) => set('max_total_uses', e.target.value)}
            placeholder="ไม่จำกัด"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mc">ลูกค้า 1 คนใช้ได้ (ครั้ง)</Label>
          <Input
            id="mc"
            type="number"
            min="1"
            value={v.max_uses_per_customer}
            onChange={(e) => set('max_uses_per_customer', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Trigger</Label>
        <select
          value={v.trigger_type}
          onChange={(e) => set('trigger_type', e.target.value as PromoFormValue['trigger_type'])}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm h-10"
        >
          <option value="manual">ใช้รหัสด้วยตัวเอง</option>
          <option value="birthday">วันเกิด (อัตโนมัติ)</option>
          <option value="first_visit">มาครั้งแรก</option>
          <option value="loyalty">สะสมแต้ม</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={v.is_active}
          onChange={(e) => set('is_active', e.target.checked)}
          className="h-4 w-4"
        />
        เปิดใช้งาน
      </label>

      <Button size="lg" type="submit" disabled={submitting} className="w-full">
        {submitting ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>

      {err && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{err}</p>}
    </form>
  )
}
