import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import { Country, DataPoint, DateDataPoints } from './api/Country';
import { isNumber } from 'util';
import { CoronaChart } from './Chart';
import Select from '@material-ui/core/Select';
import { MenuItem, FormControl, InputLabel, Container, Table, TableHead, TableRow, TableCell, AppBar, Toolbar, Typography, Checkbox, FormControlLabel, FormGroup, Box } from '@material-ui/core';
import countryCodes from './countryCodes.json'
import { countryPopulations } from './CountryPopulations'

interface CountryItem {
  code: string,
  name: string
}

interface AppState {
  country: Country,
  isNormalized: boolean
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

class App extends Component<any, AppState> {
  state: AppState = {
    country: { countrytimelinedata: [], timelineitems: [{}] },
    isNormalized: false
  };

  constructor(props: any) {
    super(props)
  }

  getCountryCode() {
    return this.props.match.params.countryCode
  }

  loadCountry(countryCode: string) {
    fetch(`https://api.thevirustracker.com/free-api?countryTimeline=${countryCode}`)
      .then(res => res.json())
      .then((data: Country) => {
        this.setState({...this.state, country: data })
      })
      .catch(console.log)
  }

  componentDidMount() {
    this.loadCountry(this.getCountryCode())
  }

  private average(xs: number[]) {
    return xs.filter(x => isNumber(x)).reduce((a, b) => a + b) / xs.length
  }
  
  private normalize(value: number): number {
      if (this.state.isNormalized) {
        let countryCode = this.getCountryCode()
        let population = countryPopulations[countryCode].population
        return 1e6 * value / population
      } else {
        return value
      }
  }

  private dateValues(dates: string[], dateDataPoints: DateDataPoints): DateValues[] {
    let roll = 7

    return dates.map((date, i) => {
      let day = dateDataPoints[date]
      let rollingDays = dates.slice(Math.max(i - (roll / 2), 0), i + (roll / 2))

      let rolling = (f: (t: DataPoint) => number) => {
        let rollingValues = rollingDays.map(d => f(dateDataPoints[d]))
        return Math.round(this.average(rollingValues))
      }

      let cumulative = (f: (t: DataPoint) => number) => {
        return daysUntilNow.map(f).reduce((a, b) => a + b)
      }

      let daysUntilNow = dates.slice(0, i + 1).map(d => dateDataPoints[d])

      return ({
        date: date,
        cases: this.normalize(day.new_daily_cases),
        rollingCases: this.normalize(rolling(d => d.new_daily_cases)),
        cumulativeCases: this.normalize(cumulative(t => t.new_daily_cases)),
        deaths: this.normalize(day.new_daily_deaths),
        rollingDeaths: this.normalize(rolling(d => d.new_daily_deaths)),
        cumulativeDeaths: this.normalize(cumulative(t => t.new_daily_deaths))
      })
    })
  }
  
  render() {
    let timelineitems = this.state.country.timelineitems
    return (timelineitems && timelineitems.length > 0)
      ? this.renderUI(timelineitems[0])
      : <div />
  }

  renderUI(timelineitem: DateDataPoints) {
    let dates = Object.keys(timelineitem).filter(d => d !== 'stat')
    let dvs = this.dateValues(dates, timelineitem)

    let rows = dvs.map(dv =>
      <TableRow>
        <TableCell>{dv.date}</TableCell>
        <TableCell>{dv.cases}</TableCell>
        <TableCell>{dv.rollingCases}</TableCell>
        <TableCell>{dv.deaths}</TableCell>
        <TableCell>{dv.rollingDeaths}</TableCell>
      </TableRow>
    )

    let datasets = [
      {
        title: 'Cases',
        color: 'rgba(75,192,192,0.3)',
        values: dvs.map(dv => dv.cases)
      },
      {
        title: 'Cases (rolling avg)',
        color: 'rgba(17,192,192,1)',
        values: dvs.map(dv => dv.rollingCases)
      },
      {
        title: 'Deaths',
        color: 'rgba(192,75,92,0.3)',
        values: dvs.map(dv => dv.deaths)
      },
      {
        title: 'Deaths (rolling avg)',
        color: 'rgba(192,75,92,1)',
        values: dvs.map(dv => dv.rollingDeaths)
      }
    ]

    let cumulativeDatasets = [
      {
        title: 'Cumulative Cases',
        color: 'rgba(17,192,192,1)',
        values: dvs.map(dv => dv.cumulativeCases)
      },
      {
        title: 'Cumulative Deaths',
        color: 'rgba(192,75,92,1)',
        values: dvs.map(dv => dv.cumulativeDeaths)
      }
    ]

    return (
      <Container>
        <AppBar color="default" position="static">
          <Toolbar>
            <Box mr={4}>
              <FormControl>
                <InputLabel id="select-country">Country</InputLabel>
                <Select
                  labelId="select-country"
                  id="select-country"
                  value={this.getCountryCode()}
                  onChange={(e) => {
                    let countryCode = e.target.value as string
                    this.props.history.push('/country/' + countryCode);
                    this.loadCountry(countryCode)
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
                    checked={this.state.isNormalized}
                    onChange={(e) => this.setState({...this.state, isNormalized: e.target.checked})}
                    name="normalized"
                    color="primary"
                  />}
                label="Per 1M Population"
              />
            </Box>
          </Toolbar>
        </AppBar>
        <CoronaChart labels={dates} datasets={datasets} />
        <CoronaChart labels={dates} datasets={cumulativeDatasets} />
        <hr />
        <Table >
          <TableHead>
            <TableRow>
              <TableCell>Day</TableCell>
              <TableCell>New Cases</TableCell>
              <TableCell>New Cases (rolling avg)</TableCell>
              <TableCell>New Deaths</TableCell>
              <TableCell>New Deaths (rolling avg)</TableCell>
            </TableRow>
          </TableHead>
          {rows}
        </Table>
      </Container>
    );
  }
}

export default App;
