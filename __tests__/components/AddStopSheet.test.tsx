import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AddStopSheet from '@/components/trip/AddStopSheet'
import type { Stop } from '@/lib/types'

const baseProps = {
  tripId: 'trip-1',
  dayIndex: 0,
  dayTitle: 'Edinburgh',
  isOpen: true,
  onClose: vi.fn(),
  onAdd: vi.fn(),
}

beforeEach(() => {
  vi.resetAllMocks()
  global.fetch = vi.fn()
})

describe('AddStopSheet', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(<AddStopSheet {...baseProps} isOpen={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Add a stop" heading when open', () => {
    render(<AddStopSheet {...baseProps} />)
    expect(screen.getByText('Add a stop')).toBeInTheDocument()
  })

  it('shows day number and title in header', () => {
    render(<AddStopSheet {...baseProps} />)
    expect(screen.getByText(/Day 1 · Edinburgh/)).toBeInTheDocument()
  })

  it('shows day without title when dayTitle is empty', () => {
    render(<AddStopSheet {...baseProps} dayTitle="" />)
    expect(screen.getByText(/Day 1$/)).toBeInTheDocument()
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    render(<AddStopSheet {...baseProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('×'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<AddStopSheet {...baseProps} onClose={onClose} />)
    const backdrop = container.querySelector('.absolute.inset-0')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the scan booking button', () => {
    render(<AddStopSheet {...baseProps} />)
    expect(screen.getByText('Scan a booking confirmation')).toBeInTheDocument()
  })

  it('shows "or describe it" divider', () => {
    render(<AddStopSheet {...baseProps} />)
    expect(screen.getByText(/or describe it/i)).toBeInTheDocument()
  })

  it('shows the text area placeholder', () => {
    render(<AddStopSheet {...baseProps} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
  })

  it('shows quick suggestion chips', () => {
    render(<AddStopSheet {...baseProps} />)
    expect(screen.getByText('☕ Coffee stop')).toBeInTheDocument()
    expect(screen.getByText('🐾 Dog walk')).toBeInTheDocument()
    expect(screen.getByText('📸 Viewpoint')).toBeInTheDocument()
  })

  it('shows generate button', () => {
    render(<AddStopSheet {...baseProps} />)
    expect(screen.getByText('✨ Generate with Claude')).toBeInTheDocument()
  })

  it('generate button is disabled when no text entered', () => {
    render(<AddStopSheet {...baseProps} />)
    const btn = screen.getByText('✨ Generate with Claude')
    expect(btn).toBeDisabled()
  })

  it('updates textarea value when typing', () => {
    render(<AddStopSheet {...baseProps} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Find a whisky distillery' } })
    expect(textarea.value).toBe('Find a whisky distillery')
  })

  it('fills textarea with suggestion command when chip is clicked', () => {
    render(<AddStopSheet {...baseProps} />)
    fireEvent.click(screen.getByText('☕ Coffee stop'))
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('coffee')
  })

  it('calls fetch with correct endpoint when generate is clicked', async () => {
    const stop: Stop = { name: 'Loch Ness Visitor Centre', type: 'sightseeing' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stop }),
    } as Response)

    render(<AddStopSheet {...baseProps} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Add a visitor centre' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/trips/trip-1/add-stop',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('shows loading state while fetching', async () => {
    let resolveFetch!: (v: unknown) => void
    global.fetch = vi.fn().mockReturnValue(
      new Promise(res => { resolveFetch = res })
    )
    render(<AddStopSheet {...baseProps} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Add café' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))
    expect(screen.getByText(/Generating/)).toBeInTheDocument()
    resolveFetch({ ok: true, json: () => Promise.resolve({ stop: { name: 'Café', type: 'cafe' } }) })
  })

  it('shows preview of generated stop', async () => {
    const stop: Stop = { name: 'Loch Ness Visitor Centre', type: 'sightseeing', description: 'Great views' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stop }),
    } as Response)

    render(<AddStopSheet {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Add visitor centre' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => {
      expect(screen.getByText('Loch Ness Visitor Centre')).toBeInTheDocument()
    })
    expect(screen.getByText('Great views')).toBeInTheDocument()
  })

  it('shows Add to Day button after preview', async () => {
    const stop: Stop = { name: 'Test Stop', type: 'sightseeing' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stop }),
    } as Response)

    render(<AddStopSheet {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => {
      expect(screen.getByText(/✓ Add to Day 1/)).toBeInTheDocument()
    })
  })

  it('calls onAdd and onClose when confirm add is clicked', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    const stop: Stop = { name: 'Test Stop', type: 'sightseeing' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stop }),
    } as Response)

    render(<AddStopSheet {...baseProps} onAdd={onAdd} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => screen.getByText(/✓ Add to Day 1/))
    fireEvent.click(screen.getByText(/✓ Add to Day 1/))

    expect(onAdd).toHaveBeenCalledWith(stop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows error message when fetch returns error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Claude API error' }),
    } as Response)

    render(<AddStopSheet {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test command' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => {
      expect(screen.getByText(/Claude API error/)).toBeInTheDocument()
    })
  })

  it('shows network error message when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))

    render(<AddStopSheet {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })

  it('shows "Try again" button after preview', async () => {
    const stop: Stop = { name: 'Test Stop', type: 'sightseeing' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stop }),
    } as Response)

    render(<AddStopSheet {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => screen.getByText('Try again'))
    fireEvent.click(screen.getByText('Try again'))
    expect(screen.queryByText('Test Stop')).not.toBeInTheDocument()
  })

  it('shows preview with address when stop has one', async () => {
    const stop: Stop = { name: 'Visitor Centre', type: 'sightseeing', address: '123 High St, Edinburgh' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stop }),
    } as Response)

    render(<AddStopSheet {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => {
      expect(screen.getByText(/123 High St, Edinburgh/)).toBeInTheDocument()
    })
  })

  it('shows preview check-in for hotel stops', async () => {
    const stop: Stop = { name: 'The Balmoral', type: 'hotel', check_in: '15:00', check_out: '11:00' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stop }),
    } as Response)

    render(<AddStopSheet {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => {
      expect(screen.getByText(/Check-in 15:00/)).toBeInTheDocument()
    })
  })

  it('shows preview dog_friendly badge when stop has it', async () => {
    const stop: Stop = { name: 'Dog Café', type: 'cafe', dog_friendly: true }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stop }),
    } as Response)

    render(<AddStopSheet {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => {
      expect(screen.getByText(/Dog friendly/)).toBeInTheDocument()
    })
  })

  it('shows Preview heading after generation', async () => {
    const stop: Stop = { name: 'Test', type: 'sightseeing' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stop }),
    } as Response)

    render(<AddStopSheet {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('✨ Generate with Claude'))

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument()
    })
  })
})
