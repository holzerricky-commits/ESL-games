import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { LocalDataBackupCard } from '@/components/local-data-backup-card'

export function SettingsOverview() {
  return (
    <div className="space-y-8">
      <LocalDataBackupCard />

      <section className="ui-section">
        <h3 className="text-sm font-medium text-foreground">Class profile</h3>
        <dl className="space-y-1 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <dt className="text-foreground">Name</dt>
            <dd>Teacher Ricky</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-foreground">Theme</dt>
            <dd>Light</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-foreground">Mode</dt>
            <dd>Teacher controls all actions</dd>
          </div>
        </dl>
      </section>

      <section className="ui-section">
        <h3 className="text-sm font-medium text-foreground">Session preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="show-hints" className="text-sm text-foreground">
              Show quick action hints
            </Label>
            <Switch id="show-hints" defaultChecked />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="compact-nav" className="text-sm text-foreground">
              Compact sidebar labels
            </Label>
            <Switch id="compact-nav" />
          </div>
        </div>
      </section>
    </div>
  )
}
