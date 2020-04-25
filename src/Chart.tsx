import React from 'react'
import { defaults, ChartComponentProps, Line } from 'react-chartjs-2'

export interface Dataset {
    title: string,
    values: number[],
    color: string
}

export interface CoronaChartProps {
    title: string,
    labels: string[],
    datasets: Dataset[]
}

export class CoronaChart extends React.Component<CoronaChartProps> {
    chartReference: React.RefObject<unknown>
    
    constructor(props: CoronaChartProps) {
        super(props)
        this.chartReference = React.createRef()
    }

    render() {
        const data = {
            labels: this.props.labels,
            datasets: this.props.datasets.map(dataset => ({
                label: dataset.title,
                fill: false,
                lineTension: 0.01,
                backgroundColor: 'rgba(75,192,192,0.4)',
                borderColor: dataset.color,
                borderCapStyle: 'butt',
                borderDash: [],
                borderDashOffset: 0.0,
                borderJoinStyle: 'miter',
                pointBorderColor: 'rgba(75,192,192,1)',
                pointBackgroundColor: '#fff',
                pointBorderWidth: 1,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: 'rgba(75,192,192,1)',
                pointHoverBorderColor: 'rgba(220,220,220,1)',
                pointHoverBorderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 10,
                data: dataset.values
            })),
        }

        const options = {
            title: {
                text: this.props.title,
                display: true
            },
        }

        return (<Line data={data} options={options}/>)
    }
}

