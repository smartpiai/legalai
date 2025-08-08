/**
 * Tests for Input component
 * Following TDD - Red phase: Write failing tests first
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test/utils'
import { Input } from './Input'

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render input with label', () => {
      render(<Input label="Email" name="email" />)
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    })

    it('should render input without label', () => {
      render(<Input name="test" placeholder="Enter text" />)
      expect(screen.getByPlaceholderText(/enter text/i)).toBeInTheDocument()
    })

    it('should render with different types', () => {
      const { rerender } = render(<Input type="text" name="text" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text')

      rerender(<Input type="email" name="email" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')

      rerender(<Input type="password" name="password" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'password')

      rerender(<Input type="number" name="number" />)
      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')
    })

    it('should render with helper text', () => {
      render(<Input name="test" helperText="This is helper text" />)
      expect(screen.getByText(/this is helper text/i)).toBeInTheDocument()
    })

    it('should render with error message', () => {
      render(<Input name="test" error="This field is required" />)
      expect(screen.getByText(/this field is required/i)).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    })

    it('should render as disabled', () => {
      render(<Input name="test" disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('should render as required', () => {
      render(<Input name="test" label="Required Field" required />)
      expect(screen.getByRole('textbox')).toHaveAttribute('required')
      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('should render with prefix', () => {
      render(<Input name="price" prefix="$" />)
      expect(screen.getByText('$')).toBeInTheDocument()
    })

    it('should render with suffix', () => {
      render(<Input name="weight" suffix="kg" />)
      expect(screen.getByText('kg')).toBeInTheDocument()
    })

    it('should render with icon', () => {
      const Icon = () => <svg data-testid="test-icon" />
      render(<Input name="search" icon={<Icon />} />)
      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('should handle value changes', () => {
      const handleChange = vi.fn()
      render(<Input name="test" onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'new value' } })
      
      expect(handleChange).toHaveBeenCalledTimes(1)
      expect(input).toHaveValue('new value')
    })

    it('should handle focus and blur events', () => {
      const handleFocus = vi.fn()
      const handleBlur = vi.fn()
      
      render(
        <Input
          name="test"
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      )
      
      const input = screen.getByRole('textbox')
      
      fireEvent.focus(input)
      expect(handleFocus).toHaveBeenCalledTimes(1)
      
      fireEvent.blur(input)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('should not allow input when disabled', () => {
      const handleChange = vi.fn()
      render(<Input name="test" disabled onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'new value' } })
      
      expect(handleChange).not.toHaveBeenCalled()
    })

    it('should handle keyboard events', () => {
      const handleKeyDown = vi.fn()
      const handleKeyUp = vi.fn()
      
      render(
        <Input
          name="test"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
        />
      )
      
      const input = screen.getByRole('textbox')
      
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(handleKeyDown).toHaveBeenCalledTimes(1)
      
      fireEvent.keyUp(input, { key: 'Enter' })
      expect(handleKeyUp).toHaveBeenCalledTimes(1)
    })

    it('should clear input when clear button is clicked', () => {
      const handleChange = vi.fn()
      render(
        <Input
          name="test"
          value="initial value"
          clearable
          onChange={handleChange}
        />
      )
      
      expect(screen.getByRole('textbox')).toHaveValue('initial value')
      
      const clearButton = screen.getByRole('button', { name: /clear/i })
      fireEvent.click(clearButton)
      
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ value: '' })
        })
      )
    })
  })

  describe('Validation', () => {
    it('should show error state', () => {
      render(<Input name="test" error="Error message" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('border-red-500')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('aria-describedby', 'test-error')
    })

    it('should show success state', () => {
      render(<Input name="test" success />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('border-green-500')
    })

    it('should handle maxLength', () => {
      render(<Input name="test" maxLength={5} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('maxLength', '5')
    })

    it('should handle minLength', () => {
      render(<Input name="test" minLength={3} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('minLength', '3')
    })

    it('should handle pattern validation', () => {
      render(<Input name="test" pattern="[A-Z]+" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('pattern', '[A-Z]+')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <Input
          name="test"
          label="Test Input"
          helperText="Help text"
          required
        />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-required', 'true')
      expect(input).toHaveAttribute('aria-describedby', 'test-helper')
    })

    it('should associate label with input', () => {
      render(<Input name="test" label="Test Label" />)
      
      const input = screen.getByLabelText(/test label/i)
      expect(input).toBeInTheDocument()
    })

    it('should have proper error announcement', () => {
      render(<Input name="test" error="Error message" />)
      
      const input = screen.getByRole('textbox')
      const errorElement = screen.getByText(/error message/i)
      
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('aria-describedby', 'test-error')
      expect(errorElement).toHaveAttribute('id', 'test-error')
    })
  })

  describe('Custom Styling', () => {
    it('should accept custom className', () => {
      render(<Input name="test" className="custom-class" />)
      expect(screen.getByRole('textbox')).toHaveClass('custom-class')
    })

    it('should accept custom container className', () => {
      render(<Input name="test" containerClassName="custom-container" />)
      expect(screen.getByRole('textbox').parentElement).toHaveClass('custom-container')
    })
  })
})