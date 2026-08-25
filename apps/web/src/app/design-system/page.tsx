'use client'

/**
 * Página de prueba temporal del sistema de diseño (Agente 4).
 * No enlazada desde la navegación — solo para validación visual manual.
 * Ver docs/design-system.md.
 */

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'

export default function DesignSystemPreviewPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  return (
    <main className="container-app py-12 space-y-12">
      <header>
        <h1 className="text-[length:var(--text-h1)] font-bold text-[var(--c-text)]">
          Sistema de diseño — Motek
        </h1>
        <p className="text-[var(--c-text-3)] mt-2">Vista previa de tokens y componentes base.</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-[length:var(--text-h2)] font-semibold">Botones</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Agregar al carrito</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Eliminar</Button>
          <Button variant="primary" loading={loading} onClick={() => setLoading((v) => !v)}>
            {loading ? 'Cargando…' : 'Alternar loading'}
          </Button>
          <Button variant="primary" disabled>
            Deshabilitado
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">sm</Button>
          <Button size="md">md</Button>
          <Button size="lg">lg</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[length:var(--text-h2)] font-semibold">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Disponible</Badge>
          <Badge variant="warning">Últimas 3 unidades</Badge>
          <Badge variant="danger">Agotado</Badge>
          <Badge variant="info">En preparación</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[length:var(--text-h2)] font-semibold">Cards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card hover>
            <CardHeader>
              <CardTitle>Filtro de aire</CardTitle>
            </CardHeader>
            <CardBody>SKU-12345 · Compatible con Honda CB160F</CardBody>
            <CardFooter>
              <Button size="sm">Agregar</Button>
              <Badge variant="success">Disponible</Badge>
            </CardFooter>
          </Card>
        </div>
      </section>

      <section className="space-y-4 max-w-md">
        <h2 className="text-[length:var(--text-h2)] font-semibold">Formulario</h2>
        <Input label="Nombre" placeholder="Tu nombre" />
        <Input label="Documento" hint="Entre 6 y 12 dígitos" />
        <Input label="Email" error="Este correo no es válido" />
        <Textarea label="Mensaje" placeholder="Cuéntanos en qué te ayudamos" />
      </section>

      <section className="space-y-4">
        <h2 className="text-[length:var(--text-h2)] font-semibold">Modal</h2>
        <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirmar acción">
          <p className="text-[var(--c-text-2)] mb-4">¿Deseas continuar con esta acción?</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Confirmar
            </Button>
          </div>
        </Modal>
      </section>

      <section className="space-y-4">
        <h2 className="text-[length:var(--text-h2)] font-semibold">Estados de carga</h2>
        <div className="flex items-center gap-4">
          <Spinner />
          <SkeletonLine className="w-32" />
          <SkeletonBlock className="w-24 h-24" />
        </div>
      </section>
    </main>
  )
}
