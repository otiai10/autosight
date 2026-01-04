import { useState, useCallback } from 'react';

export interface WizardState {
  currentStep: number;
  completedSteps: Set<number>;
  goToStep: (index: number) => void;
  nextStep: () => void;
  resetWizard: () => void;
  canNavigateToStep: (index: number) => boolean;
}

export function useWizardState(totalSteps: number = 3): WizardState {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const canNavigateToStep = useCallback(
    (index: number) => {
      // 現在のステップか、完了済みステップならナビゲート可能
      return index === currentStep || completedSteps.has(index);
    },
    [currentStep, completedSteps]
  );

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSteps && canNavigateToStep(index)) {
        setCurrentStep(index);
      }
    },
    [totalSteps, canNavigateToStep]
  );

  const nextStep = useCallback(() => {
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [currentStep, totalSteps]);

  const resetWizard = useCallback(() => {
    setCurrentStep(0);
    setCompletedSteps(new Set());
  }, []);

  return {
    currentStep,
    completedSteps,
    goToStep,
    nextStep,
    resetWizard,
    canNavigateToStep,
  };
}
