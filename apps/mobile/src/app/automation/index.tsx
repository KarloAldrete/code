import { getCalendars } from "expo-localization";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Text } from "@/components/text";
import { TaskAutomationValidationError } from "@/features/tasks/api";
import { AutomationForm } from "@/features/tasks/components/AutomationForm";
import { useCreateTaskAutomation } from "@/features/tasks/hooks/useAutomations";
import { useThemeColors } from "@/lib/theme";

export default function NewAutomationScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const createAutomation = useCreateTaskAutomation();
  const defaultTimezone = useMemo(
    () => getCalendars()[0]?.timeZone ?? "UTC",
    [],
  );
  const [fieldError, setFieldError] = useState<{
    attr: string | null;
    message: string | null;
  } | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "New automation",
          headerStyle: { backgroundColor: themeColors.background },
          headerTintColor: themeColors.gray[12],
          presentation: "modal",
        }}
      />
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          className="flex-1 px-4 pt-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View className="gap-4">
            <View className="rounded-xl bg-gray-2 px-4 py-4">
              <Text className="font-semibold text-[16px] text-gray-12">
                New automation
              </Text>
            </View>

            <AutomationForm
              initialValues={{
                timezone: defaultTimezone,
                enabled: true,
              }}
              isSubmitting={createAutomation.isPending}
              submitLabel="Create automation"
              fieldError={fieldError}
              generalError={generalError}
              onSubmit={async (values) => {
                setFieldError(null);
                setGeneralError(null);

                try {
                  const automation = await createAutomation.mutateAsync(values);
                  router.replace(`/automation/${automation.id}`);
                } catch (error) {
                  if (error instanceof TaskAutomationValidationError) {
                    setFieldError({
                      attr: error.attr,
                      message: error.message,
                    });
                    return;
                  }

                  setGeneralError(
                    "Could not create automation. Please try again.",
                  );
                }
              }}
              onCancel={() => router.back()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
