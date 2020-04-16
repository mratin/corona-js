
export interface DataPoint {    
    new_daily_cases: number,
    new_daily_deaths: number,
    total_cases: number,
    total_recoveries: number,
    total_deaths: number
}

export interface Info {    
    ourid: number,
    title: string,
    code: string,
    source: string
}

export interface CountryTimelineData {
    info: Info
}

export interface DateDataPoints {
    [index: string]: DataPoint
}

export interface Country {
    countrytimelinedata: CountryTimelineData[],
    timelineitems: DateDataPoints[]
}