import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(newLang);
  };

  const isArabic = i18n.language === "ar";
  const toggleLabel = isArabic
    ? t("language.switchToEnglish")
    : t("language.switchToArabic");

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleLanguage}
      data-testid="button-language-toggle"
      title={toggleLabel}
    >
      <Globe className="h-4 w-4" />
      <span className="sr-only">{toggleLabel}</span>
    </Button>
  );
}
