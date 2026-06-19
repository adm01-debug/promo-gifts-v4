import { useTheme } from '@/contexts/ThemeContext';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme, actualTheme } = useTheme();
  const sonnerTheme = (theme as string) === 'auto' ? 'system' : actualTheme;

  return (
    <Sonner
      theme={sonnerTheme}
      className="toaster group"
      // Accessibility: aria-live region for screen readers
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground min-h-[44px]',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground min-h-[44px]',
        },
      }}
      // Accessibility: sonner renders its own aria-live region; label it here
      containerAriaLabel="Notificações"
      {...props}
    />
  );
};

export { Toaster, toast };
