import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DeletedStopsSheet, { type DeletedEntry } from '@/components/trip/DeletedStopsSheet'
import type { Day } from '@/lib/types'

const days: Day[] = [
  { day_number: 1, title: 'Edinburgh', stops: [] },
  { day_number: 2, title: 'Pitlochry', stops: [] },
]

function makeEntry(overrides: Partial<DeletedEntry> = {}): DeletedEntry {
  return {
    stop: { name: 'Edinburgh Castle', type: 'sightseeing' },
    dayIdx: 0,
    stopIdx: 1,
    deletedAt: Date.now(),
    ...overrides,
  }
}

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  entries: [],
  days,
  onRestore: vi.fn(),
  onClearAll: vi.fn(),
}

describe('DeletedStopsSheet', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(<DeletedStopsSheet {...baseProps} isOpen={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Removed stops" heading when open', () => {
    render(<DeletedStopsSheet {...baseProps} />)
    expect(screen.getByText('Removed stops')).toBeInTheDocument()
  })

  it('shows "Nothing removed" when entries array is empty', () => {
    render(<DeletedStopsSheet {...baseProps} entries={[]} />)
    expect(screen.getByText('Nothing removed')).toBeInTheDocument()
  })

  it('shows empty state UI when no entries', () => {
    render(<DeletedStopsSheet {...baseProps} entries={[]} />)
    expect(screen.getByText('No removed stops')).toBeInTheDocument()
  })

  it('shows entry count when entries exist', () => {
    const entries = [makeEntry(), makeEntry({ stop: { name: 'Loch Ness', type: 'viewpoint' }, dayIdx: 1 })]
    render(<DeletedStopsSheet {...baseProps} entries={entries} />)
    expect(screen.getByText(/2 stops — tap to restore/)).toBeInTheDocument()
  })

  it('shows singular "stop" text for single entry', () => {
    render(<DeletedStopsSheet {...baseProps} entries={[makeEntry()]} />)
    expect(screen.getByText(/1 stop — tap to restore/)).toBeInTheDocument()
  })

  it('renders each deleted stop by name', () => {
    const entries = [
      makeEntry({ stop: { name: 'Edinburgh Castle', type: 'sightseeing' } }),
      makeEntry({ stop: { name: 'Balmoral Hotel', type: 'hotel' }, dayIdx: 1 }),
    ]
    render(<DeletedStopsSheet {...baseProps} entries={entries} />)
    expect(screen.getByText('Edinburgh Castle')).toBeInTheDocument()
    expect(screen.getByText('Balmoral Hotel')).toBeInTheDocument()
  })

  it('shows the correct day label for each entry', () => {
    const entries = [makeEntry({ dayIdx: 1 })]
    render(<DeletedStopsSheet {...baseProps} entries={entries} />)
    expect(screen.getByText(/Day 2/)).toBeInTheDocument()
  })

  it('shows day title alongside day number', () => {
    const entries = [makeEntry({ dayIdx: 0 })]
    render(<DeletedStopsSheet {...baseProps} entries={entries} />)
    // The sub-line shows "Day 1 · Edinburgh · just now" — find element containing the day label
    const subLine = screen.getByText(/Day 1/)
    expect(subLine.textContent).toContain('Edinburgh')
  })

  it('renders Restore button for each entry', () => {
    const entries = [makeEntry(), makeEntry({ stop: { name: 'Loch Ness', type: 'viewpoint' }, dayIdx: 1 })]
    render(<DeletedStopsSheet {...baseProps} entries={entries} />)
    expect(screen.getAllByText(/↩ Restore/)).toHaveLength(2)
  })

  it('calls onRestore with the correct entry when Restore is clicked', () => {
    const onRestore = vi.fn()
    const entry = makeEntry()
    render(<DeletedStopsSheet {...baseProps} entries={[entry]} onRestore={onRestore} />)
    fireEvent.click(screen.getByText('↩ Restore'))
    expect(onRestore).toHaveBeenCalledWith(entry)
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    render(<DeletedStopsSheet {...baseProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('×'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<DeletedStopsSheet {...baseProps} onClose={onClose} />)
    // The backdrop is the first absolute div inside the fixed container
    const backdrop = container.querySelector('.absolute.inset-0')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows "Clear all removed stops" button when entries exist', () => {
    render(<DeletedStopsSheet {...baseProps} entries={[makeEntry()]} />)
    expect(screen.getByText('Clear all removed stops')).toBeInTheDocument()
  })

  it('does not show "Clear all" button when entries is empty', () => {
    render(<DeletedStopsSheet {...baseProps} entries={[]} />)
    expect(screen.queryByText('Clear all removed stops')).not.toBeInTheDocument()
  })

  it('calls onClearAll when clear button is clicked', () => {
    const onClearAll = vi.fn()
    render(<DeletedStopsSheet {...baseProps} entries={[makeEntry()]} onClearAll={onClearAll} />)
    fireEvent.click(screen.getByText('Clear all removed stops'))
    expect(onClearAll).toHaveBeenCalledOnce()
  })

  it('shows correct icons for known stop types', () => {
    const hotelEntry = makeEntry({ stop: { name: 'The Balmoral', type: 'hotel' } })
    render(<DeletedStopsSheet {...baseProps} entries={[hotelEntry]} />)
    // Hotel icon is 🛏️
    expect(screen.getByText('🛏️')).toBeInTheDocument()
  })

  it('shows fallback icon for unknown stop type', () => {
    const unknownEntry = makeEntry({ stop: { name: 'Mystery Place', type: 'other' } })
    render(<DeletedStopsSheet {...baseProps} entries={[unknownEntry]} />)
    expect(screen.getByText('📍')).toBeInTheDocument()
  })

  it('shows "just now" for very recently deleted stops', () => {
    const entry = makeEntry({ deletedAt: Date.now() })
    render(<DeletedStopsSheet {...baseProps} entries={[entry]} />)
    expect(screen.getByText(/just now/)).toBeInTheDocument()
  })

  it('shows minutes ago for older deletions', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const entry = makeEntry({ deletedAt: fiveMinutesAgo })
    render(<DeletedStopsSheet {...baseProps} entries={[entry]} />)
    expect(screen.getByText(/5m ago/)).toBeInTheDocument()
  })
})
