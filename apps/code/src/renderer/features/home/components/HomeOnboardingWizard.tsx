import { ArrowLeft, Check, House, Sparkle } from "@phosphor-icons/react";
import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { useState } from "react";
import { type HomeAnswers, type HomeRole, useHomeStore } from "../store";
import { ROLES, USE_CASES } from "../wizardConfig";

interface HomeOnboardingWizardProps {
  onStart: () => void;
}

type Step = "welcome" | "role" | "use_cases" | "generating";

export function HomeOnboardingWizard({ onStart }: HomeOnboardingWizardProps) {
  const complete = useHomeStore((s) => s.complete);
  const [step, setStep] = useState<Step>("welcome");
  const [role, setRole] = useState<HomeRole | null>(null);
  const [useCases, setUseCases] = useState<string[]>([]);

  const next = () => {
    if (step === "welcome") setStep("role");
    else if (step === "role") setStep("use_cases");
    else if (step === "use_cases") {
      setStep("generating");
      // Mock generation pause for effect
      window.setTimeout(() => {
        const answers: HomeAnswers = { role, products: [], useCases };
        complete(answers);
      }, 1400);
    }
  };

  const back = () => {
    if (step === "use_cases") setStep("role");
    else if (step === "role") setStep("welcome");
  };

  const canContinue =
    step === "welcome" ||
    (step === "role" && role !== null) ||
    (step === "use_cases" && useCases.length > 0);

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      height="100%"
      className="overflow-auto px-4 py-10"
    >
      <Box className="w-full max-w-160">
        {step !== "welcome" && step !== "generating" && (
          <StepIndicator step={step} />
        )}

        {step === "welcome" && (
          <WelcomeStep
            onStart={() => {
              onStart();
              next();
            }}
          />
        )}

        {step === "role" && (
          <RoleStep
            value={role}
            onChange={setRole}
            onNext={next}
            onBack={back}
            canContinue={canContinue}
          />
        )}

        {step === "use_cases" && (
          <UseCasesStep
            value={useCases}
            onChange={setUseCases}
            onNext={next}
            onBack={back}
            canContinue={canContinue}
          />
        )}

        {step === "generating" && <GeneratingStep />}
      </Box>
    </Flex>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const order: Step[] = ["role", "use_cases"];
  const idx = order.indexOf(step);
  return (
    <Flex gap="2" mb="4">
      {order.map((s, i) => (
        <Box
          key={s}
          className={`h-1 flex-1 rounded-full ${
            i <= idx ? "bg-(--accent-9)" : "bg-(--gray-4)"
          }`}
        />
      ))}
    </Flex>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <Flex direction="column" align="center" gap="4" className="text-center">
      <Flex
        align="center"
        justify="center"
        className="h-12 w-12 rounded-full bg-(--accent-3) text-(--accent-11)"
      >
        <House size={24} />
      </Flex>
      <Heading size="6" className="text-(--gray-12)">
        Your home is created for you
      </Heading>
      <Text size="3" className="max-w-120 text-(--gray-11)">
        Fill out a few questions and we'll create a home page that gets you to
        what is relevant for you — quickly.
      </Text>
      <Button size="3" onClick={onStart} mt="2">
        Get started
      </Button>
    </Flex>
  );
}

function RoleStep({
  value,
  onChange,
  onNext,
  onBack,
  canContinue,
}: {
  value: HomeRole | null;
  onChange: (v: HomeRole) => void;
  onNext: () => void;
  onBack: () => void;
  canContinue: boolean;
}) {
  return (
    <Flex direction="column" gap="4">
      <Box>
        <Heading size="5" className="text-(--gray-12)">
          What's your role?
        </Heading>
        <Text size="2" className="text-(--gray-11)">
          We'll tailor the home page to what your role usually cares about.
        </Text>
      </Box>
      <Box className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ROLES.map((r) => (
          <ChoiceCard
            key={r.value}
            selected={value === r.value}
            label={r.label}
            description={r.description}
            onClick={() => onChange(r.value)}
          />
        ))}
      </Box>
      <WizardFooter onBack={onBack} onNext={onNext} canContinue={canContinue} />
    </Flex>
  );
}

function UseCasesStep({
  value,
  onChange,
  onNext,
  onBack,
  canContinue,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  canContinue: boolean;
}) {
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <Flex direction="column" gap="4">
      <Box>
        <Heading size="5" className="text-(--gray-12)">
          Why do you think PostHog will be useful?
        </Heading>
        <Text size="2" className="text-(--gray-11)">
          Pick the use cases you care about. We'll feature them on your home.
        </Text>
      </Box>
      <Box className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {USE_CASES.map((u) => (
          <ChoiceCard
            key={u.id}
            selected={value.includes(u.id)}
            label={u.label}
            onClick={() => toggle(u.id)}
            multi
          />
        ))}
      </Box>
      <WizardFooter
        onBack={onBack}
        onNext={onNext}
        canContinue={canContinue}
        nextLabel="Build my home"
      />
    </Flex>
  );
}

function GeneratingStep() {
  return (
    <Flex
      direction="column"
      align="center"
      gap="3"
      className="py-8 text-center"
    >
      <Flex
        align="center"
        justify="center"
        className="h-12 w-12 animate-pulse rounded-full bg-(--accent-3) text-(--accent-11)"
      >
        <Sparkle size={24} weight="fill" />
      </Flex>
      <Heading size="5" className="text-(--gray-12)">
        Building your home page…
      </Heading>
      <Text size="2" className="text-(--gray-11)">
        Picking metrics, apps, and views based on your answers.
      </Text>
    </Flex>
  );
}

function ChoiceCard({
  selected,
  label,
  description,
  onClick,
  multi,
}: {
  selected: boolean;
  label: string;
  description?: string;
  onClick: () => void;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-start gap-2 rounded-(--radius-3) border p-3 text-left transition-all ${
        selected
          ? "border-(--accent-9) bg-(--accent-3)"
          : "border-(--gray-5) bg-(--gray-1) hover:border-(--accent-7) hover:bg-(--gray-2)"
      }`}
    >
      <Flex
        align="center"
        justify="center"
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          multi ? "rounded-(--radius-1)" : "rounded-full"
        } border ${
          selected
            ? "border-(--accent-9) bg-(--accent-9) text-white"
            : "border-(--gray-6) bg-(--gray-1)"
        }`}
      >
        {selected && <Check size={10} weight="bold" />}
      </Flex>
      <Flex direction="column" gap="1" className="min-w-0">
        <Text size="2" weight="medium" className="text-(--gray-12)">
          {label}
        </Text>
        {description && (
          <Text size="1" className="text-(--gray-11)">
            {description}
          </Text>
        )}
      </Flex>
    </button>
  );
}

function WizardFooter({
  onBack,
  onNext,
  canContinue,
  nextLabel = "Continue",
}: {
  onBack: () => void;
  onNext: () => void;
  canContinue: boolean;
  nextLabel?: string;
}) {
  return (
    <Flex justify="between" mt="2">
      <Button variant="soft" color="gray" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </Button>
      <Button onClick={onNext} disabled={!canContinue}>
        {nextLabel}
      </Button>
    </Flex>
  );
}
