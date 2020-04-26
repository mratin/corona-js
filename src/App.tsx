import React, { Component } from 'react'
import './App.css'
import { Country, DataPoint, DateDataPoints, Info } from './api/Country'
import { isNumber } from 'util'
import { CoronaChart, Dataset } from './Chart'
import Select from '@material-ui/core/Select'
import { MenuItem, FormControl, InputLabel, Container, AppBar, Toolbar, Checkbox, FormControlLabel, Box } from '@material-ui/core'
import countryCodes from './countryCodes.json'
import { countryPopulations } from './CountryPopulations'
import { colors, Color } from './colors'
import queryString from 'querystring'
import _ from 'lodash'

interface CountryItem {
  code: string,
  name: string
}

interface AppState {
  country: Country[]
}

interface DateValues {
  date: string,
  cases: number,
  cumulativeCases: number,
  rollingCases: number,
  deaths: number,
  rollingDeaths: number,
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
  isNormalized: boolean,
  isComparisonMode: boolean
}

class App extends Component<any, AppState> {
  state: AppState = {
    country: []
  };

  constructor(props: any) {
    super(props)
  }

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

  getSettings(): Settings {
    const values = queryString.parse(this.props.location.search.slice(1))
    return {
      isNormalized: _.get(values, 'normalized', 'false') === 'true',
      isComparisonMode: _.get(values, 'comparisonMode', 'false') === 'true'
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
        Promise.all(responses.map(res => res.json()))
          .then((data: Country[]) => this.setState({ ...this.state, country: data })))
  }

  update(countryCodes: string[], settings: Settings) {
    let params = [
      ['comparisonMode', `${settings.isComparisonMode}`],
      ['normalized', `${settings.isNormalized}`],
    ].map(s => s.join('=')).join('&')

    this.props.history.push('/country/' + countryCodes.join(',') + '?' + params)
  }

  componentDidMount() {
    this.load()
  }

  private average(xs: number[]) {
    return xs.filter(x => isNumber(x)).reduce((a, b) => a + b) / xs.length
  }

  private normalize(countryCode: string, value: number): number {
    if (this.getSettings().isNormalized) {
      let population = countryPopulations[countryCode].population
      return 1e6 * value / population
    } else {
      return value
    }
  }

  private dateValues(countryCode: string, dates: string[], dateDataPoints: DateDataPoints): DateValues[] {
    let roll = 7

    return dates.map((date, i) => {
      let day: DataPoint = dateDataPoints[date] || emptyDataPoint

      let rollingDays = dates.slice(Math.max(i - (roll / 2), 0), i + (roll / 2))

      let rolling = (f: (t: DataPoint) => number) => {
        let rollingValues = rollingDays.map(d => f(dateDataPoints[d] || emptyDataPoint))
        return Math.round(this.average(rollingValues))
      }

      return ({
        date: date,
        cases: this.normalize(countryCode, day.new_daily_cases),
        rollingCases: this.normalize(countryCode, rolling(d => d.new_daily_cases)),
        cumulativeCases: this.normalize(countryCode, day.total_cases),
        deaths: this.normalize(countryCode, day.new_daily_deaths),
        rollingDeaths: this.normalize(countryCode, rolling(d => d.new_daily_deaths)),
        cumulativeDeaths: this.normalize(countryCode, day.total_deaths)
      })
    })
  }

  private getNormalizeSuffix() {
    return this.getSettings().isNormalized ? " Per 1 Million Population" : ""
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

  render() {
    if (this.state.country.length === 0) return <div />

    let allDates: Date[] = this.state.country
      .map(c => c.timelineitems[0])
      .map(t => Object.keys(t).filter(d => d !== 'stat' && t[d].total_deaths >= 1)
        .map((d: string) => new Date(d))).flat()
    let dates: string[] = Array.from(new Set(allDates.sort((a, b) => a.getTime() - b.getTime()).map(d => this.toDateKey(d))))

    let allDataCharts: DataChart[][] = this.getSettings().isComparisonMode
      ? this.state.country.map((c, i) =>
        this.createComparisonDataCharts(dates, c.timelineitems[0], c.countrytimelinedata[0].info, colors[i % colors.length])
      )
      : [this.createDataCharts(dates, this.state.country[0].timelineitems[0], this.state.country[0].countrytimelinedata[0].info, colors[0])]

    let numberOfCharts: number = Math.min(...allDataCharts.map(s => s.length))

    return (
      <Container maxWidth="xl">
        <AppBar color="default" position="sticky">
          <Toolbar>
            <Box mr={4}>
              <FormControl>
                <InputLabel id="select-country">Country</InputLabel>
                <Select
                  multiple={this.getSettings().isComparisonMode}
                  labelId="select-country"
                  id="select-country"
                  value={this.getSettings().isComparisonMode ? this.getCountryCodes() : this.getCountryCodes()[0]}
                  onChange={(e) => {
                    if (this.getSettings().isComparisonMode) {
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
                    <MenuItem value={c.code}>{c.name}</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={this.getSettings().isNormalized}
                    onChange={(e) => this.update(this.getCountryCodes(), { ...this.getSettings(), isNormalized: e.target.checked })}
                    name="normalized"
                    color="primary"
                  />}
                label="Per 1M Population"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={this.getSettings().isComparisonMode}
                    onChange={(e) => {
                      this.update(this.getCountryCodes(), { ...this.getSettings(), isComparisonMode: e.target.checked })
                    }}
                    name="enableMultiple"
                    color="primary"
                  />}
                label="Comparison Mode"
              />
            </Box>
          </Toolbar>
        </AppBar>
        {Array.from(Array(numberOfCharts).keys()).map(i =>
          <CoronaChart title={allDataCharts[0][i].title} labels={dates} datasets={allDataCharts.map(s => s[i].datasets).flat()} />
        )}
      </Container>
    );
  }
}

export default App;
