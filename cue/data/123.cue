#dashboard: { // 0.0
  // Unique numeric identifier for the dashboard.
  // TODO must isolate or remove identifiers local to a Grafana instance...?
  id?: number
  // Unique dashboard identifier that can be generated by anyone. string (8-40)
  uid?: string
  // Title of dashboard.
  title?: string
  // Description of dashboard.
  description?: string

  gnetId?: string
  // Tags associated with dashboard.
  tags?: [...string]
  // Theme of dashboard.
  style: *"light" | "dark"
  // Timezone of dashboard,
  timezone?: *"browser" | "utc"
  // Whether a dashboard is editable or not.
  editable: bool | *true
  // 0 for no shared crosshair or tooltip (default).
  // 1 for shared crosshair.
  // 2 for shared crosshair AND shared tooltip.
  graphTooltip: >=0 & <=2 | *0
  // Time range for dashboard, e.g. last 6 hours, last 7 days, etc
  time?: {
      from: string | *"now-6h"
      to:   string | *"now"
  }
  // Timepicker metadata.
  timepicker?: {
      // Whether timepicker is collapsed or not.
      collapse: bool | *false
      // Whether timepicker is enabled or not.
      enable: bool | *true
      // Whether timepicker is visible or not.
      hidden: bool | *false
      // Selectable intervals for auto-refresh.
      refresh_intervals: [...string] | *["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"]
  }
  // Templating.
  templating?: list: [...{...}]
  // Annotations.
  annotations?: list: [...{
      builtIn: number | *0
      // Datasource to use for annotation.
      datasource: string
      // Whether annotation is enabled.
      enable?: bool | *true
      // Whether to hide annotation.
      hide?: bool | *false
      // Annotation icon color.
      iconColor?: string
      // Name of annotation.
      name?: string
      type: string | *"dashboard"
      // Query for annotation data.
      rawQuery?: string
      showIn:   number | *0
  }]
  // Auto-refresh interval.
  refresh?: string
  // Version of the JSON schema, incremented each time a Grafana update brings
  // changes to said schema.
  schemaVersion: number | *25
  // Version of the dashboard, incremented each time the dashboard is updated.
  version?: number
  panels?: [...#Panel]

  // Dashboard panels. Panels are canonically defined inline
  // because they share a version timeline with the dashboard
  // schema; they do not vary independently. We create a separate,
  // synthetic Family to represent them in Go, for ease of generating
  // e.g. JSON Schema.
  #Panel: {
      ...
      // The panel plugin type id. 
      type: !=""

      // Internal - the exact major and minor versions of the panel plugin
      // schema. Hidden and therefore not a part of the data model, but
      // expected to be filled with panel plugin schema versions so that it's
      // possible to figure out which schema version matched on a successful
      // unification.
      // _pv: { maj: int, min: int }
      // The major and minor versions of the panel plugin for this schema.
      // TODO 2-tuple list instead of struct?
      panelSchema?: { maj: number, min: number }

      // Panel title.
      title?: string
      // Description.
      description?: string
      // Whether to display the panel without a background.
      transparent: bool | *false
      // Name of default datasource.
      datasource?: string
      // Grid position.
      gridPos?: {
          // Panel
          h: number & >0 | *9
          // Panel
          w: number & >0 & <=24 | *12
          // Panel x
          x: number & >=0 & <24 | *0
          // Panel y
          y: number & >=0 | *0
          // true if fixed
          static?: bool
      }
      // Panel links.
      // links?: [..._panelLink]
      // Name of template variable to repeat for.
      repeat?: string
      // Direction to repeat in if 'repeat' is set.
      // "h" for horizontal, "v" for vertical.
      repeatDirection: *"h" | "v"
      // Schema for panel targets is specified by datasource
      // plugins. We use a placeholder definition, which the Go
      // schema loader either left open/as-is with the Base
      // variant of the Dashboard and Panel families, or filled
      // with types derived from plugins in the Instance variant.
      // When working directly from CUE, importers can extend this
      // type directly to achieve the same effect.
      targets?: [...{...}]

      // The values depend on panel type
      options: {...}

      fieldConfig: {
          defaults: {
              // The display value for this field.  This supports template variables blank is auto
              displayName?: string

              // This can be used by data sources that return and explicit naming structure for values and labels
              // When this property is configured, this value is used rather than the default naming strategy.
              displayNameFromDS?: string

              // Human readable field metadata
              description?: string

              // An explict path to the field in the datasource.  When the frame meta includes a path,
              // This will default to `${frame.meta.path}/${field.name}
              //
              // When defined, this value can be used as an identifier within the datasource scope, and
              // may be used to update the results
              path?: string

              // True if data source can write a value to the path.  Auth/authz are supported separately
              writeable?: bool

              // True if data source field supports ad-hoc filters
              filterable?: bool

              // Numeric Options
              unit?: string

              // Significant digits (for display)
              decimals?: number

              min?: number
              max?: number

              //   // Convert input values into a display string
              //   mappings?: ValueMapping[];

              //   // Map numeric values to states
              //   thresholds?: ThresholdsConfig;

              //   // Map values to a display color
              //   color?: FieldColor;

              //   // Used when reducing field values
              //   nullValueMode?: NullValueMode;

              //   // The behavior when clicking on a result
              links?: [...]

              // Alternative to empty string
              noValue?: string

              // Can always exist. Valid fields within this are
              // defined by the panel plugin - that's the
              // PanelFieldConfig that comes from the plugin.
              custom?: {...}
          }
          overrides: [...{
              matcher: {
                  id: string | *""
                  options?: _
              }
              properties: [...{
                  id: string | *""
                  value?: _
              }]
          }]
      }
  }
}