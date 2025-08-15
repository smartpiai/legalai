/**
 * Progress Indicator Components
 * Shows current step and progress in the contract creation wizard
 */
import React from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import { WizardStep, WIZARD_STEPS } from '@/types/contract-creation.types'

interface ProgressIndicatorProps {
  currentStep: WizardStep
  completedSteps: WizardStep[]
  className?: string
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  completedSteps,
  className
}) => {
  return (
    <div className={cn('w-full', className)}>
      <div 
        role="progressbar"
        aria-label="Creation progress"
        aria-valuenow={currentStep}
        aria-valuemax={4}
        className="flex items-center justify-between mb-8"
      >
        {WIZARD_STEPS.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center flex-1">
            <div className="flex items-center w-full">
              <div
                className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium',
                  completedSteps.includes(step.id)
                    ? 'bg-green-500 border-green-500 text-white'
                    : currentStep === step.id
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                )}
              >
                {completedSteps.includes(step.id) ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : (
                  step.id
                )}
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-px mx-2',
                    completedSteps.includes(step.id) ? 'bg-green-500' : 'bg-gray-300'
                  )}
                />
              )}
            </div>
            <div className="mt-2 text-center">
              <p className="text-xs font-medium text-gray-900">{step.title}</p>
              <p className="text-xs text-gray-500 mt-1">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Mobile-specific stepper
export const MobileStepper: React.FC<ProgressIndicatorProps> = ({ currentStep, completedSteps }) => (
  <div data-testid="mobile-stepper" className="md:hidden">
    <ProgressIndicator currentStep={currentStep} completedSteps={completedSteps} />
  </div>
)

// Desktop-specific stepper
export const DesktopStepper: React.FC<ProgressIndicatorProps> = ({ currentStep, completedSteps }) => (
  <div data-testid="desktop-stepper" className="hidden md:block">
    <ProgressIndicator currentStep={currentStep} completedSteps={completedSteps} />
  </div>
)