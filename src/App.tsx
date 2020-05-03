import React, { Component } from 'react'
import './App.css'
import { Country, DataPoint, DateDataPoints, Info } from './api/Country'
import { isNumber } from 'util'
import { CoronaChart, Dataset } from './Chart'
import Select from '@material-ui/core/Select'
import { MenuItem, FormControl, InputLabel, Container, AppBar, Toolbar, Checkbox, FormControlLabel, Box, Paper, Button, Theme } from '@material-ui/core'
import Alert from '@material-ui/lab/Alert';
import countryCodes from './data/countryCodes.json'
import { countryPopulations } from './data/CountryPopulations'
import { colors, Color } from './colors'
import queryString, { ParsedUrlQuery } from 'querystring'
import _ from 'lodash'
import { withStyles } from '@material-ui/styles'
import SettingsIcon from '@material-ui/icons/Settings'
import { SettingsDrawer } from './SettingsDrawer'

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
  selectedCountries: Country[],
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

export interface Settings {
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
export const StartAtFirstDeaths: S<number> = numberSetting('startAtFirstDeaths', 0)
export const RollingDays: S<number> = numberSetting('rollingDays', 7)

interface SValue<T> {
  s: S<T>,
  value: T
}

class App extends Component<any, AppState> {
  constructor(props: any) {
    super(props)
    
    this.update = this.update.bind(this)
    this.toggleDrawer = this.toggleDrawer.bind(this)
  }

  state: AppState = {
    selectedCountries: [],
    showSettingsDrawer: false
  };

  componentDidUpdate(prevProps: any) {
    if (prevProps.match.params.countryCodes !== this.props.match.params.countryCodes) {
      this.load()
    }
  }

  parseCountryCodes(props: any): string[] {
    const { countryCodes } = props.match.params
    return countryCodes ? countryCodes.split(',') : []
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
          .then((data: Country[]) => this.setState({ ...this.state, selectedCountries: data })))
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

  render() {
    const { selectedCountries, showSettingsDrawer } = this.state;
    const comparisonModeOn = this.getSettings().comparisonMode.value;

    const countriesWithData = selectedCountries.filter(c => c.timelineitems)

    let allDates: Date[] = countriesWithData
      .map(c => c.timelineitems[0])
      .map(t => Object.keys(t).filter(d => d !== 'stat' && t[d].total_deaths >= this.getSettings().startAtFirstDeaths.value)
        .map((d: string) => new Date(d))).flat()
    let dates: string[] = Array.from(new Set(allDates.sort((a, b) => a.getTime() - b.getTime()).map(d => this.toDateKey(d))))

    let allDataCharts: DataChart[][] = countriesWithData.length > 0 ? (comparisonModeOn
      ? countriesWithData.map((c, i) => 
          this.createComparisonDataCharts(dates, c.timelineitems[0], c.countrytimelinedata[0].info, colors[i % colors.length])
      )
      : selectedCountries[0].timelineitems ? [this.createDataCharts(dates, selectedCountries[0].timelineitems[0], selectedCountries[0].countrytimelinedata[0].info, colors[0])] : [])
      : []

    let numberOfCharts: number = allDataCharts.length > 0 ? Math.min(...allDataCharts.map(s => s.length)) : 0

    let chartContent = numberOfCharts > 0 ?
      <Paper elevation={2}>
        { comparisonModeOn && selectedCountries.length !== countriesWithData.length && 
          <Box>
            <Alert style={{ justifyContent: 'center' }} severity="warning">One of the selected countries is missing data!</Alert>
          </Box>
        }
        {Array.from(Array(numberOfCharts).keys()).map(i =>
          <CoronaChart key={i} title={allDataCharts[0][i].title} labels={dates} datasets={allDataCharts.map(s => s[i].datasets).flat()} />
        )}
      </Paper>
      : selectedCountries.length > 0 ?
      <Paper style={{ margin: 'auto', width: 'fit-content' }}>
        <Alert style={{ maxWidth: 384 }} severity="error">{ selectedCountries.length > 1 && comparisonModeOn ? 'Selected countries are missing data!' : 'Selected country is missing data!'}</Alert>
      </Paper>
      : <Alert style={{ margin: 'auto', width: 'fit-content', maxWidth: 384 }} severity="info">Select one or more countries to begin!</Alert>

    return (
      <Container maxWidth="xl">
        <AppBar color="default" position="sticky">
          <Toolbar>
            <Box mr={4}>
              <FormControl>
                <InputLabel id="select-country">Country</InputLabel>
                <Select
                  style={{ minWidth: 96 }}
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
                    disabled={selectedCountries.length === 0}
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
                    disabled={selectedCountries.length === 0}
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
        <SettingsDrawer
          isOpen={showSettingsDrawer}
          settings={this.getSettings()}
          countryCodes={this.getCountryCodes()}
          update={this.update}
          toggleDrawer={this.toggleDrawer}
          hasSelectedCountry={selectedCountries.length > 0}
        />
        <Box marginTop={4}>
          {chartContent}
        </Box>
      </Container>
    );
  }
}

export default withStyles(styles)(App)
