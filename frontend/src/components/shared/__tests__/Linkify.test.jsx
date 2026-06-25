import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import Linkify from '../Linkify'

describe('Linkify', () => {
  // --- Null / empty ---
  test('renders nothing when text is null', () => {
    const { container } = render(<Linkify text={null} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders nothing when text is empty string', () => {
    const { container } = render(<Linkify text="" />)
    expect(container.firstChild).toBeNull()
  })

  // --- Plain text with no URLs ---
  test('renders plain text with no links when there are no URLs', () => {
    render(<Linkify text="Hello world" />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  // --- Single http URL ---
  test('renders an http URL as a clickable anchor', () => {
    render(<Linkify text="Visit http://example.com for more" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'http://example.com')
    expect(link).toHaveTextContent('http://example.com')
  })

  test('sets target=_blank on http URL', () => {
    render(<Linkify text="http://example.com" />)
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
  })

  test('sets rel=noopener noreferrer on http URL', () => {
    render(<Linkify text="http://example.com" />)
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer')
  })

  // --- https URL ---
  test('renders an https URL as a clickable anchor', () => {
    render(<Linkify text="Check https://example.com/path?q=1" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com/path?q=1')
  })

  // --- Text surrounding the URL is preserved ---
  test('preserves text before and after a URL', () => {
    render(<Linkify text="See https://x.com for details" />)
    // The text nodes "See " and " for details" must be present
    expect(screen.getByRole('link')).toHaveTextContent('https://x.com')
    expect(screen.getByText(/See/)).toBeInTheDocument()
    expect(screen.getByText(/for details/)).toBeInTheDocument()
  })

  // --- Multiple URLs ---
  test('renders multiple URLs in one string as separate anchors', () => {
    render(<Linkify text="First https://a.com and second https://b.com" />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', 'https://a.com')
    expect(links[1]).toHaveAttribute('href', 'https://b.com')
  })

  // --- Trailing punctuation is stripped from href ---
  test('strips trailing period from URL href', () => {
    render(<Linkify text="See https://example.com." />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com')
    // Link text content must be exactly the URL without trailing period
    expect(link.textContent).toBe('https://example.com')
  })

  test('strips trailing comma from URL href', () => {
    render(<Linkify text="Visit https://example.com, then go home" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  test('strips trailing closing paren from URL href', () => {
    render(<Linkify text="(see https://example.com)" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  // --- www. URLs ---
  test('renders a www. URL as a link with https href', () => {
    render(<Linkify text="Go to www.example.com now" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://www.example.com')
    expect(link).toHaveTextContent('www.example.com')
  })

  // --- Link style ---
  test('applies indigo color and underline style to links', () => {
    render(<Linkify text="https://example.com" />)
    const link = screen.getByRole('link')
    // Check inline style is set (color and textDecoration)
    expect(link).toHaveStyle('color: #6366f1')
    expect(link).toHaveStyle('text-decoration: underline')
  })

  // --- stopPropagation ---
  test('link click stops event propagation', () => {
    const parentHandler = vi.fn()
    render(
      <div onClick={parentHandler}>
        <Linkify text="Click https://example.com here" />
      </div>
    )
    fireEvent.click(screen.getByRole('link'))
    expect(parentHandler).not.toHaveBeenCalled()
  })
})
