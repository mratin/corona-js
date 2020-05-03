import React from "react";
import {
  Drawer,
  Card,
  CardContent,
  List,
  ListItem,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@material-ui/core";
import { Settings, RollingDays, StartAtFirstDeaths } from "./App";
import _ from "lodash";

interface Props {
  isOpen: boolean
  settings: Settings
  countryCodes: string[]
  update: (countryCodes: string[], settings: Settings) => void
  toggleDrawer: (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => void
  hasSelectedCountry: boolean
}

interface LabelledValue<T> {
  label: string,
  value: T
}

export class SettingsDrawer extends React.Component<Props> {
  getRollingAverageValues() {
    const { settings } = this.props;

    let current = settings.rollingDays.value;
    return this.getLabelledValues(
      [
        { label: "1 Day", value: 1 },
        { label: "3 Days", value: 3 },
        { label: "5 Days", value: 5 },
        { label: "1 Week", value: 7 },
        { label: "2 Weeks", value: 15 },
        { label: "3 Weeks", value: 21 },
        { label: "1 Month", value: 30 },
      ],
      { label: `${current} Days`, value: current }
    );
  }

  getStartAtValues() {
    const { settings } = this.props
    let current = settings.startAtFirstDeaths.value;
    return this.getLabelledValues(
      [
        { label: "1 Case", value: 0 },
        { label: "1 Death", value: 1 },
        { label: "5 Deaths", value: 5 },
        { label: "10 Deaths", value: 10 },
        { label: "100 Deaths", value: 100 },
      ],
      { label: `${current} Deaths`, value: current }
    );
  }

  getLabelledValues<T>(suggested: LabelledValue<T>[], current: LabelledValue<T>): LabelledValue<T>[] {
    return (suggested.map(v => v.value).indexOf(current.value) >= 0)
      ? suggested
      : _.sortBy(_.concat(suggested, current), 'value')
  }

  render() {
    const { isOpen, settings, countryCodes, update, toggleDrawer, hasSelectedCountry } = this.props;
    return (
      <Drawer anchor="right" open={isOpen} onClose={toggleDrawer(false)}>
        <Card onClick={toggleDrawer(false)}>
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
                <InputLabel id="select-rolling-days">
                  Rolling Average
                </InputLabel>
                <Select
                  disabled={!hasSelectedCountry}
                  labelId="select-rolling-days"
                  id="select-rolling-days"
                  value={settings.rollingDays.value}
                  onChange={(e) =>
                    update(countryCodes, {
                      ...settings,
                      rollingDays: {
                        s: RollingDays,
                        value: e.target.value as number,
                      },
                    })
                  }
                >
                  {this.getRollingAverageValues().map((labelledValue) => (
                    <MenuItem
                      key={labelledValue.value}
                      value={labelledValue.value}
                    >
                      {labelledValue.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </ListItem>
            <ListItem>
              <FormControl style={{ minWidth: 120 }}>
                <InputLabel id="select-start-deaths">Start After</InputLabel>
                <Select
                  disabled={!hasSelectedCountry}
                  labelId="select-start-deaths"
                  id="select-start-deaths"
                  value={settings.startAtFirstDeaths.value}
                  onChange={(e) =>
                    update(countryCodes, {
                      ...settings,
                      startAtFirstDeaths: {
                        s: StartAtFirstDeaths,
                        value: e.target.value as number,
                      },
                    })
                  }
                >
                  {this.getStartAtValues().map((labelledValue) => (
                    <MenuItem
                      key={labelledValue.value}
                      value={labelledValue.value}
                    >
                      {labelledValue.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </ListItem>
          </CardContent>
        </Card>
      </Drawer>
    );
  }
}
