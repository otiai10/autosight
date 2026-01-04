import React from 'react';
import { WizardStepper, StepConfig } from './WizardStepper';

interface WizardContainerProps {
  steps: StepConfig[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (index: number) => void;
  canNavigateToStep: (index: number) => boolean;
  children: React.ReactNode[];
}

export function WizardContainer({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep,
  children,
}: WizardContainerProps) {
  return (
    <div className="w-full">
      <WizardStepper
        steps={steps}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={onStepClick}
        canNavigateToStep={canNavigateToStep}
      />
      <div className="mt-4">
        {React.Children.toArray(children)[currentStep]}
      </div>
    </div>
  );
}
