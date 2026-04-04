'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Nehnutelnost = {
  id: string
  nazov: string
  lokalita: string
  ulica: string
  typ_transakcie: string
  typ_nehnutelnosti: string
  cena: number
  plocha: number
  eurM2: number
  izby: number
  stav_inzeratu: string
  balkon: boolean
  garaz: boolean
  vytah: boolean
}

export default function NehnutelnostiPage() {
  const [items, setItems] = useState<Nehnutelnost[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nazov: '', lokalita: '', ulica: '', typ_transakcie: 'predaj',
    typ_nehnutelnosti: 'byt', cena: '', plocha: '', izby: '',
    poschodie: '', stav: 'novostavba', balkon: false, garaz: false,
    vytah: false, url: '', stav_inzeratu: 'aktívny'
  })

  async function fetchItems() {
    const { data } = await supabase.from('nehnutelnosti').select('*').order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  async function handleSave() {
    if (!form.lokalita) return alert('Lokalita je povinná!')
    setSaving(true)
    const { error } = await supabase.from('nehnutelnosti').insert([{
      ...form,
      cena: form.cena ? parseFloat(form.cena) : null,
      plocha: form.plocha ? parseFloat(form.plocha) : null,
      izby: form.izby ? parseInt(form.izby) : null,
      poschodie: form.poschodie ? parseInt(form.poschodie) : null,
    }])
    if (error) alert('Chyba: ' + error.message)
    else {
      setShowModal(false)
      setForm({ nazov: '', lokalita: '', ulica: '', typ_transakcie: 'predaj', typ_nehnutelnosti: 'byt', cena: '', plocha: '', izby: '', poschodie: '', stav: 'novostavba', balkon: false, garaz: false, vytah: false, url: '', stav_inzeratu: 'aktívny' })
      fetchItems()
    }
    setSaving(false)
  }

  const inp = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: '100%', fontSize: '14px' }
  const lbl = { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }

  const stavColor: Record<string, string> = {
    'aktívny': '#30d158', 'rezervovaný': '#ff9f0a', 'predaný': '#ff453a', 'stiahnutý': '#8e8e93'
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 style={{ fontSize: '28px', fontWeight: '600' }}>Nehnuteľnosti</h1>
        <button onClick={() => setShowModal(true)} style={{ background: '#0071e3', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>+ Pridať nehnuteľnosť</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Načítavam...</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>Žiadne nehnuteľnosti zatiaľ.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Lokalita', 'Typ', 'Transakcia', 'Cena', 'Plocha', '€/m²', 'Izby', 'Stav'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: '500' }}>{n.lokalita}</div>
                    {n.ulica && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{n.ulica}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{n.typ_nehnutelnosti || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: n.typ_transakcie === 'predaj' ? 'rgba(0,113,227,0.15)' : 'rgba(48,209,88,0.15)', color: n.typ_transakcie === 'predaj' ? '#0071e3' : '#30d158' }}>{n.typ_transakcie}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: '500' }}>{n.cena ? n.cena.toLocaleString('sk-SK') + ' €' : '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{n.plocha ? n.plocha + ' m²' : '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{n.eurM2 ? n.eurM2.toLocaleString('sk-SK') : '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{n.izby || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: `${stavColor[n.stav_inzeratu]}22`, color: stavColor[n.stav_inzeratu] || '#8e8e93' }}>{n.stav_inzeratu}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', padding: '24px', width: '560px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Nová nehnuteľnosť</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div><label style={lbl}>Názov / popis</label><input style={inp} value={form.nazov} onChange={e => setForm({...form, nazov: e.target.value})} placeholder="3-izbový byt, centrum" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={lbl}>Lokalita *</label><input style={inp} value={form.lokalita} onChange={e => setForm({...form, lokalita: e.target.value})} placeholder="Bratislava" /></div>
                <div><label style={lbl}>Ulica</label><input style={inp} value={form.ulica} onChange={e => setForm({...form, ulica: e.target.value})} placeholder="Hlavná 12" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={lbl}>Typ transakcie</label>
                  <select style={inp} value={form.typ_transakcie} onChange={e => setForm({...form, typ_transakcie: e.target.value})}>
                    <option value="predaj">Predaj</option>
                    <option value="prenajom">Prenájom</option>
                  </select>
                </div>
                <div><label style={lbl}>Typ nehnuteľnosti</label>
                  <select style={inp} value={form.typ_nehnutelnosti} onChange={e => setForm({...form, typ_nehnutelnosti: e.target.value})}>
                    <option value="byt">Byt</option>
                    <option value="dom">Dom</option>
                    <option value="pozemok">Pozemok</option>
                    <option value="kancelaria">Kancelária</option>
                    <option value="obchodny_priestor">Obchodný priestor</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div><label style={lbl}>Cena (€)</label><input style={inp} type="number" value={form.cena} onChange={e => setForm({...form, cena: e.target.value})} placeholder="150000" /></div>
                <div><label style={lbl}>Plocha (m²)</label><input style={inp} type="number" value={form.plocha} onChange={e => setForm({...form, plocha: e.target.value})} placeholder="65" /></div>
                <div><label style={lbl}>Izby</label><input style={inp} type="number" value={form.izby} onChange={e => setForm({...form, izby: e.target.value})} placeholder="3" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={lbl}>Poschodie</label><input style={inp} type="number" value={form.poschodie} onChange={e => setForm({...form, poschodie: e.target.value})} placeholder="2" /></div>
                <div><label style={lbl}>Stav inzerátu</label>
                  <select style={inp} value={form.stav_inzeratu} onChange={e => setForm({...form, stav_inzeratu: e.target.value})}>
                    <option value="aktívny">Aktívny</option>
                    <option value="rezervovaný">Rezervovaný</option>
                    <option value="predaný">Predaný</option>
                    <option value="stiahnutý">Stiahnutý</option>
                  </select>
                </div>
              </div>
              <div><label style={lbl}>URL inzerátu</label><input style={inp} value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://nehnutelnosti.sk/..." /></div>
              <div style={{ display: 'flex', gap: '20px' }}>
                {[['balkon', 'Balkón'], ['garaz', 'Garáž'], ['vytah', 'Výťah']].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={e => setForm({...form, [key]: e.target.checked})} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '14px' }}>Zrušiť</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0071e3', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>{saving ? 'Ukladám...' : 'Uložiť'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}