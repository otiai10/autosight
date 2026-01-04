import { HiCheck } from 'react-icons/hi';

export interface StepConfig {
  id: string;
  label: string;
  description?: string;
}

interface WizardStepperProps {
  steps: StepConfig[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (index: number) => void;
  canNavigateToStep: (index: number) => boolean;
}

export function WizardStepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep,
}: WizardStepperProps) {
  return (
    <ol className="flex items-center w-full mb-8">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(index);
        const isCurrent = index === currentStep;
        const isClickable = canNavigateToStep(index);
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.id}
            className={`flex items-center ${isLast ? 'shrink-0' : 'flex-1'}`}
          >
            <button
              type="button"
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={`flex items-center gap-2 ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              {/* ステップインジケーター */}
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                  isCompleted
                    ? 'bg-blue-600 text-white'
                    : isCurrent
                      ? 'border-2 border-blue-600 text-blue-600'
                      : 'border-2 border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'
                } ${isClickable && !isCurrent ? 'hover:bg-blue-100 dark:hover:bg-blue-900' : ''}`}
              >
                {isCompleted ? (
                  <HiCheck className="w-4 h-4" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </span>

              {/* ラベル */}
              <div className="text-left">
                <span
                  className={`text-sm font-medium ${
                    isCompleted || isCurrent
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {step.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {step.description}
                  </p>
                )}
              </div>
            </button>

            {/* 接続線 */}
            {!isLast && (
              <div
                className={`flex-1 h-0.5 mx-4 min-w-8 ${
                  isCompleted
                    ? 'bg-blue-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
