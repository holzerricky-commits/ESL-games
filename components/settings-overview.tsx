import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function SettingsOverview() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-[var(--border)] bg-[var(--card)]">
        <CardHeader>
          <CardTitle>Class profile</CardTitle>
          <CardDescription>Teacher-led setup defaults for projected classroom sessions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Display name: Teacher Ricky</p>
          <p>Theme: Dark energetic</p>
          <p>Mode: Teacher controls all actions</p>
        </CardContent>
      </Card>

      <Card className="border-[var(--border)] bg-[var(--card)]">
        <CardHeader>
          <CardTitle>Session preferences</CardTitle>
          <CardDescription>Structure-only controls for Milestone 1.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-hints" className="text-sm text-foreground">
              Show quick action hints
            </Label>
            <Switch id="show-hints" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="compact-nav" className="text-sm text-foreground">
              Compact sidebar labels
            </Label>
            <Switch id="compact-nav" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-[var(--border)] bg-[var(--card)] lg:col-span-2">
        <CardHeader>
          <CardTitle>Milestone note</CardTitle>
          <CardDescription>This page is intentionally lightweight in Milestone 1.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Advanced settings, persistence, and admin controls are planned for later milestones.
        </CardContent>
      </Card>
    </div>
  )
}
