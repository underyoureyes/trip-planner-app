import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NavigateButton from '@/components/trip/NavigateButton'

describe('NavigateButton', () => {
  describe('compact mode', () => {
    it('renders as a link', () => {
      render(<NavigateButton destination="Edinburgh Castle" compact />)
      expect(screen.getByRole('link', { name: /navigate/i })).toBeInTheDocument()
    })

    it('links to google maps URL', () => {
      render(<NavigateButton destination="Edinburgh Castle" compact />)
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', expect.stringContaining('comgooglemaps://'))
    })
  })

  describe('full mode', () => {
    it('renders a button', () => {
      render(<NavigateButton destination="Edinburgh Castle" />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('shows default label with destination', () => {
      render(<NavigateButton destination="Edinburgh Castle" />)
      expect(screen.getByText('Navigate to Edinburgh Castle')).toBeInTheDocument()
    })

    it('uses custom label when provided', () => {
      render(<NavigateButton destination="Edinburgh Castle" label="Go Here" />)
      expect(screen.getByText('Go Here')).toBeInTheDocument()
    })

    it('opens options panel on button click', () => {
      render(<NavigateButton destination="Edinburgh Castle" />)
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('Google Maps')).toBeInTheDocument()
      expect(screen.getByText('Apple Maps')).toBeInTheDocument()
      expect(screen.getByText('Google Maps (web)')).toBeInTheDocument()
    })

    it('shows destination in options header', () => {
      render(<NavigateButton destination="Edinburgh Castle" />)
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getAllByText('Edinburgh Castle').length).toBeGreaterThan(0)
    })

    it('closes panel when button clicked again', () => {
      render(<NavigateButton destination="Edinburgh Castle" />)
      const btn = screen.getByRole('button')
      fireEvent.click(btn)
      fireEvent.click(btn)
      expect(screen.queryByText('Google Maps')).not.toBeInTheDocument()
    })

    it('closes panel when a map option is selected', () => {
      render(<NavigateButton destination="Edinburgh Castle" />)
      fireEvent.click(screen.getByRole('button'))
      fireEvent.click(screen.getByText('Apple Maps'))
      expect(screen.queryByText('Open in…')).not.toBeInTheDocument()
    })

    it('options panel links have correct hrefs', () => {
      render(<NavigateButton destination="Test Place" />)
      fireEvent.click(screen.getByRole('button'))
      const links = screen.getAllByRole('link')
      const hrefs = links.map(l => l.getAttribute('href'))
      expect(hrefs.some(h => h?.includes('comgooglemaps://'))).toBe(true)
      expect(hrefs.some(h => h?.includes('maps.apple.com'))).toBe(true)
      expect(hrefs.some(h => h?.includes('google.com/maps'))).toBe(true)
    })
  })
})
