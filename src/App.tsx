import React, { Component } from 'react'
import './App.css'
import { Country, DataPoint, DateDataPoints, Info } from './api/Country'
import { isNumber } from 'util'
import { CoronaChart, Dataset } from './Chart'
import Select from '@material-ui/core/Select'
import { MenuItem, FormControl, InputLabel, Container, AppBar, Toolbar, Checkbox, FormControlLabel, Box, Paper, Button, Drawer, Theme, List, ListItem, ListItemIcon, ListItemText, Divider, Typography, Card, CardContent } from '@material-ui/core'
import Alert from '@material-ui/lab/Alert';
import countryCodes from './countryCodes.json'
import { countryPopulations } from './CountryPopulations'
import { colors, Color } from './colors'
import queryString, { ParsedUrlQuery } from 'querystring'
import _ from 'lodash'
import { withStyles } from '@material-ui/styles'
import SettingsIcon from '@material-ui/icons/Settings'

const styles = (theme: Theme) => ({
  grow: {
    flexGrow: 1,
  }
})

interface CountryItem {
  code: string,
  name: string
}

interface AppState {
  country: Country[],
  showSettingsDrawer: boolean
}

interface DateValues {
  date: string,
  cases: number,
  cumulativeCases: number,
  rollingCases: number | undefined,
  deaths: number,
  rollingDeaths: number | undefined,
  cumulativeDeaths: number,
}

const emptyDataPoint: DataPoint = {
  new_daily_cases: 0,
  new_daily_deaths: 0,
  total_cases: 0,
  total_recoveries: 0,
  total_deaths: 0
}

interface DataChart {
  title: string,
  datasets: Dataset[]
}

interface Settings {
  normalized: SValue<boolean>,
  comparisonMode: SValue<boolean>,
  startAtFirstDeaths: SValue<number>,
  rollingDays: SValue<number>
}

class S<T> {
  name: string
  defaultValue: T

  constructor(name: string, defaultValue: T) {
    this.name = name
    this.defaultValue = defaultValue
  }

  parse(s: string | string[]): T {
    return s as any as T
  }
  serialize(t: T): string {
    return `${t}`
  }
}

const booleanSetting = (name: string, defaultValue: boolean) => ({
  name: name,
  defaultValue: defaultValue,
  parse: (s: string) => s === 'true',
  serialize: (t: boolean) => `${t}`
})

const numberSetting = (name: string, defaultValue: number) => ({
  name: name,
  defaultValue: defaultValue,
  parse: (s: string) => Number(s),
  serialize: (t: number) => `${t}`
})

const Normalized: S<boolean> = booleanSetting('normalized', false)
const ComparisonMode: S<boolean> = booleanSetting('comparisonMode', false)
const StartAtFirstDeaths: S<number> = numberSetting('startAtFirstDeaths', 0)
const RollingDays: S<number> = numberSetting('rollingDays', 7)

interface SValue<T> {
  s: S<T>,
  value: T
}

interface LabelledValue<T> {
  label: string,
  value: T
}

class App extends Component<any, AppState> {
  state: AppState = {
    country: [],
    showSettingsDrawer: false
  };

  componentDidUpdate(prevProps: any) {
    if (prevProps.match.params.countryCodes !== this.props.match.params.countryCodes) {
      this.load()
    }
  }

  parseCountryCodes(props: any): string[] {
    return props.match.params.countryCodes.split(',')
  }

  getCountryCodes(): string[] {
    return this.parseCountryCodes(this.props)
  }

  getSetting<T>(s: S<T>, parsedQueryString: ParsedUrlQuery): SValue<T> {
    let param = _.get(parsedQueryString, s.name)
    let v = (param === undefined) ? s.defaultValue : s.parse(param)

    return {
      s: s,
      value: v
    }
  }

  getSettings(): Settings {
    const values = queryString.parse(this.props.location.search.slice(1))

    return {
      normalized: this.getSetting<boolean>(Normalized, values),
      comparisonMode: this.getSetting<boolean>(ComparisonMode, values),
      startAtFirstDeaths: this.getSetting<number>(StartAtFirstDeaths, values),
      rollingDays: this.getSetting<number>(RollingDays, values)
    }
  }

  load() {
    this.loadCountries(this.getCountryCodes())
  }

  loadCountries(countryCodes: string[]) {
    let urls = countryCodes.map(cc => `https://api.thevirustracker.com/free-api?countryTimeline=${cc}`)
    console.log("Fetching: " + countryCodes.join(","))
    Promise.all(urls.map(u => fetch(u)))
      .then(responses =>
        Promise.all(responses
          .map(res => res.text().then(t => JSON.parse(t.slice(t.indexOf('{'))))))
          .then((data: Country[]) => this.setState({ ...this.state, country: data })))
  }

  update(countryCodes: string[], settings: Settings) {
    let settingValues: SValue<any>[] =
      [settings.normalized, settings.comparisonMode, settings.startAtFirstDeaths, settings.rollingDays]
    let params = settingValues
      .filter(setting => setting.value !== setting.s.defaultValue)
      .map(setting => `${setting.s.name}=${setting.s.serialize(setting.value)}`)
      .join('&')

    this.props.history.push('/country/' + countryCodes.join(',') + '?' + params)
  }

  componentDidMount() {
    this.load()
  }

  private average(xs: number[]) {
    return xs.filter(x => isNumber(x)).reduce((a, b) => a + b, 0) / xs.length
  }

  private normalize(countryCode: string, value: number): number {
    if (this.getSettings().normalized.value) {
      let population = countryPopulations[countryCode].population
      return 1e6 * value / population
    } else {
      return value
    }
  }

  private dateValues(countryCode: string, dates: string[], dateDataPoints: DateDataPoints): DateValues[] {
    let roll = Math.max(this.getSettings().rollingDays.value, 1)

    return dates.map((date, i) => {
      let day: DataPoint = dateDataPoints[date] || emptyDataPoint

      let rollingDays = dates.slice(Math.max(i - Math.floor(roll / 2), 0), i + Math.ceil(roll / 2))

      let rolling = (f: (t: DataPoint) => number) => {
        let rollingValues = rollingDays.map(d => f(dateDataPoints[d] || emptyDataPoint))
        return Math.round(this.average(rollingValues))
      }

      let rollingDefined = i < dates.length - Math.floor(roll / 2)
      let rollingCases = rollingDefined ? this.normalize(countryCode, rolling(d => d.new_daily_cases)) : undefined
      let rollingDeaths = rollingDefined ? this.normalize(countryCode, rolling(d => d.new_daily_deaths)) : undefined

      return ({
        date: date,
        cases: this.normalize(countryCode, day.new_daily_cases),
        rollingCases: rollingCases,
        cumulativeCases: this.normalize(countryCode, day.total_cases),
        deaths: this.normalize(countryCode, day.new_daily_deaths),
        rollingDeaths: rollingDeaths,
        cumulativeDeaths: this.normalize(countryCode, day.total_deaths)
      })
    })
  }

  private getNormalizeSuffix() {
    return this.getSettings().normalized.value ? " Per 1 Million Population" : ""
  }

  private createDataCharts(dates: string[], timelineitem: DateDataPoints, countryInfo: Info, color: Color): DataChart[] {
    let dvs = this.dateValues(countryInfo.code, dates, timelineitem)

    return [
      {
        title: `${countryInfo.title}: New Cases and Deaths${this.getNormalizeSuffix()}`,
        datasets:
          [
            {
              title: `New Cases`,
              color: `rgba(${color.cases},0.2)`,
              values: dvs.map(dv => dv.cases)
            },
            {
              title: `New Cases (rolling avg)`,
              color: `rgba(${color.cases},1)`,
              values: dvs.map(dv => dv.rollingCases)
            },
            {
              title: `New Deaths`,
              color: `rgba(${color.deaths},0.2)`,
              values: dvs.map(dv => dv.deaths)
            },
            {
              title: `New Deaths (rolling avg)`,
              color: `rgba(${color.deaths},1)`,
              values: dvs.map(dv => dv.rollingDeaths)
            }
          ]
      },
      {
        title: `${countryInfo.title}: Total Cases and Deaths${this.getNormalizeSuffix()}`,
        datasets: [
          {
            title: `Total Cases`,
            color: `rgba(${color.cases},1)`,
            values: dvs.map(dv => dv.cumulativeCases)
          },
          {
            title: `Total Deaths`,
            color: `rgba(${color.deaths},1)`,
            values: dvs.map(dv => dv.cumulativeDeaths)
          }
        ]
      }
    ]
  }

  private createComparisonDataCharts(dates: string[], timelineitem: DateDataPoints, countryInfo: Info, color: Color): DataChart[] {
    let dvs = this.dateValues(countryInfo.code, dates, timelineitem)

    return [
      {
        title: `New Cases (rolling avg)${this.getNormalizeSuffix()}`,
        datasets: [
          {
            title: `${countryInfo.title}`,
            color: `rgba(${color.cases},1)`,
            values: dvs.map(dv => dv.rollingCases)
          }
        ]
      },
      {
        title: `New Deaths${this.getNormalizeSuffix()}`,
        datasets: [
          {
            title: `${countryInfo.title}`,
            color: `rgba(${color.cases},1)`,
            values: dvs.map(dv => dv.rollingDeaths)
          }
        ]
      },
      {
        title: `Total Cases${this.getNormalizeSuffix()}`,
        datasets: [
          {
            title: `${countryInfo.title}`,
            color: `rgba(${color.cases},1)`,
            values: dvs.map(dv => dv.cumulativeCases)
          }
        ]
      },
      {
        title: `Total Deaths${this.getNormalizeSuffix()}`,
        datasets: [
          {
            title: `${countryInfo.title}`,
            color: `rgba(${color.cases},1)`,
            values: dvs.map(dv => dv.cumulativeDeaths)
          }
        ]
      }
    ]
  }

  private toDateKey(d: Date): string { // TODO worst hack ever. take care of dates earlier when fetching data instead
    let day: number = d.getDate()
    let dayString = (day < 10) ? '0' + day : day
    return `${d.getMonth() + 1}/${dayString}/${d.getFullYear().toString().slice(2)}`
  }

  toggleDrawer(open: boolean) {
    return (
      event: React.KeyboardEvent | React.MouseEvent,
    ) => {
      if (
        event.type === 'keydown' &&
        ((event as React.KeyboardEvent).key === 'Tab' ||
          (event as React.KeyboardEvent).key === 'Shift')
      ) {
        return;
      }

      this.setState({ ...this.state, showSettingsDrawer: open });
    }
  }

  getLabelledValues<T>(suggested: LabelledValue<T>[], current: LabelledValue<T>): LabelledValue<T>[] {
    return (suggested.map(v => v.value).indexOf(current.value) >= 0)
      ? suggested
      : _.sortBy(_.concat(suggested, current), 'value')
  }

  getRollingAverageValues() {
    let current = this.getSettings().rollingDays.value
    return this.getLabelledValues([
      { label: "1 Day", value: 1 },
      { label: "3 Days", value: 3 },
      { label: "5 Days", value: 5 },
      { label: "1 Week", value: 7 },
      { label: "2 Weeks", value: 15 },
      { label: "3 Weeks", value: 21 },
      { label: "1 Month", value: 30 }
    ],
      { label: `${current} Days`, value: current }
    )
  }

  getStartAtValues() {
    let current = this.getSettings().startAtFirstDeaths.value
    return this.getLabelledValues([
      { label: "1 Case", value: 0 },
      { label: "1 Death", value: 1 },
      { label: "5 Deaths", value: 5 },
      { label: "10 Deaths", value: 10 },
      { label: "100 Deaths", value: 100 }
    ],
      { label: `${current} Deaths`, value: current }
    )
  }

  render() {
    const { country } = this.state;
    if (country.length === 0) return <div />

    let allDates: Date[] = country
      .filter(c => c.timelineitems)
      .map(c => c.timelineitems[0])
      .map(t => Object.keys(t).filter(d => d !== 'stat' && t[d].total_deaths >= this.getSettings().startAtFirstDeaths.value)
        .map((d: string) => new Date(d))).flat()
    let dates: string[] = Array.from(new Set(allDates.sort((a, b) => a.getTime() - b.getTime()).map(d => this.toDateKey(d))))

    let allDataCharts: DataChart[][] = dates.length > 0 ? (this.getSettings().comparisonMode.value
      ? country.map((c, i) =>
        this.createComparisonDataCharts(dates, c.timelineitems[0], c.countrytimelinedata[0].info, colors[i % colors.length])
      )
      : [this.createDataCharts(dates, country[0].timelineitems[0], country[0].countrytimelinedata[0].info, colors[0])])
      : []

    let numberOfCharts: number = allDataCharts.length > 0 ? Math.min(...allDataCharts.map(s => s.length)) : 0

    let chartContent = numberOfCharts > 0 ?
      <Paper elevation={2}>
        {Array.from(Array(numberOfCharts).keys()).map(i =>
          <CoronaChart key={i} title={allDataCharts[0][i].title} labels={dates} datasets={allDataCharts.map(s => s[i].datasets).flat()} />
        )}
      </Paper>
      :
      <Paper style={{ margin: 'auto', width: 'fit-content' }}>
        <Alert style={{ maxWidth: 256 }} severity="error">Selected country is missing data!</Alert>
      </Paper>

    return (
      <Container maxWidth="xl">
        <AppBar color="default" position="sticky">
          <Toolbar>
            <Box mr={4}>
              <FormControl>
                <InputLabel id="select-country">Country</InputLabel>
                <Select
                  multiple={this.getSettings().comparisonMode.value}
                  labelId="select-country"
                  id="select-country"
                  value={this.getSettings().comparisonMode.value ? this.getCountryCodes() : this.getCountryCodes()[0]}
                  onChange={(e) => {
                    if (this.getSettings().comparisonMode.value) {
                      let countryCodes = e.target.value as string[]
                      if (countryCodes.length > 0) {
                        this.update(countryCodes, this.getSettings())
                      }
                    } else {
                      let countryCode = e.target.value as string
                      this.update([countryCode], this.getSettings());
                    }
                  }}>
                  {countryCodes.map(c =>
                    <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={this.getSettings().normalized.value}
                    onChange={(e) => this.update(this.getCountryCodes(),
                      { ...this.getSettings(), normalized: ({ s: Normalized, value: e.target.checked }) })
                    }
                    name="normalized"
                    color="primary"
                  />}
                label="Per 1M Population"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={this.getSettings().comparisonMode.value}
                    onChange={(e) =>
                      this.update(this.getCountryCodes(),
                        { ...this.getSettings(), comparisonMode: ({ s: ComparisonMode, value: e.target.checked }) })
                    }
                    name="enableMultiple"
                    color="primary"
                  />}
                label="Comparison Mode"
              />
            </Box>
            <div className={this.props.classes.grow}></div>
            <Box><Button onClick={this.toggleDrawer(true)}><SettingsIcon /></Button></Box>
          </Toolbar>
        </AppBar>
        <Drawer anchor="right" open={this.state.showSettingsDrawer} onClose={this.toggleDrawer(false)}>
          <Card onClick={this.toggleDrawer(false)}>
            <CardContent>
              <List>
                <ListItem>
                  <Typography variant="h5" gutterBottom>
                    Settings
                  </Typography>
                </ListItem>
              </List>
              <ListItem>
                <FormControl style={{ minWidth: 120 }}>
                  <InputLabel id="select-rolling-days">Rolling Average</InputLabel>
                  <Select
                    labelId="select-rolling-days"
                    id="select-rolling-days"
                    value={this.getSettings().rollingDays.value}
                    onChange={(e) =>
                      this.update(this.getCountryCodes(),
                        { ...this.getSettings(), rollingDays: ({ s: RollingDays, value: e.target.value as number }) })
                    }>
                    {this.getRollingAverageValues().map(labelledValue =>
                      <MenuItem key={labelledValue.value} value={labelledValue.value}>{labelledValue.label}</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </ListItem>
              <ListItem>
                <FormControl style={{ minWidth: 120 }}>
                  <InputLabel id="select-start-deaths">Start After</InputLabel>
                  <Select
                    labelId="select-start-deaths"
                    id="select-start-deaths"
                    value={this.getSettings().startAtFirstDeaths.value}
                    onChange={(e) =>
                      this.update(this.getCountryCodes(),
                        { ...this.getSettings(), startAtFirstDeaths: ({ s: StartAtFirstDeaths, value: e.target.value as number }) })
                    }>
                    {this.getStartAtValues().map(labelledValue =>
                      <MenuItem key={labelledValue.value} value={labelledValue.value}>{labelledValue.label}</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </ListItem>
            </CardContent>
          </Card>
        </Drawer>
        <Box marginTop={4}>
          {chartContent}
        </Box>
      </Container>
    );
  }
}

export default withStyles(styles)(App)
