/**
 * Cancel Confirmation Modal Component
 * Confirms user's intention to discard changes
 */
import React from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'

interface CancelModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  hasChanges: boolean
}

export const CancelModal: React.FC<CancelModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  hasChanges 
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-500 mr-3" />
            <h2 className="text-lg font-semibold">Discard Changes?</h2>
          </div>
          <p className="text-gray-600 mb-6">
            {hasChanges 
              ? 'You have unsaved changes that will be lost if you continue.'
              : 'Are you sure you want to cancel creating this contract?'
            }
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={onClose}>
              Keep Editing
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              Discard Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}