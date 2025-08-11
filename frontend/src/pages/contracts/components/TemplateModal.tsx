/**
 * Template Selection Modal Component
 * Allows users to select from available contract templates
 */
import React from 'react'
import { XMarkIcon, DocumentIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'
import { ContractTemplate, CONTRACT_TYPES } from '@/types/contract-creation.types'

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: ContractTemplate) => void
  templates: ContractTemplate[]
  isLoading?: boolean
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  templates,
  isLoading = false
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Select Template</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
              <p>Loading templates...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer"
                  onClick={() => onSelectTemplate(template)}
                >
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      {CONTRACT_TYPES.find(type => type.value === template.category)?.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onClose}>
              Use Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}