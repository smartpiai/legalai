/**
 * Legal Metrics Component
 * Professional metrics cards for legal operations
 */
import React from 'react'
import { FileText, Users, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface MetricData {
  title: string
  value: string | number
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  icon: React.ReactNode
  color: 'brand' | 'success' | 'warning' | 'error'
}

const legalMetrics: MetricData[] = [
  {
    title: 'Active Contracts',
    value: '1,247',
    trend: { value: 12.5, direction: 'up' },
    icon: <FileText className="text-gray-800 size-6 dark:text-white/90" />,
    color: 'brand'
  },
  {
    title: 'Pending Reviews',
    value: '23',
    trend: { value: 8.2, direction: 'down' },
    icon: <Users className="text-gray-800 size-6 dark:text-white/90" />,
    color: 'warning'
  },
  {
    title: 'Expiring Soon',
    value: '7',
    trend: { value: 15.3, direction: 'up' },
    icon: <AlertTriangle className="text-gray-800 size-6 dark:text-white/90" />,
    color: 'error'
  },
  {
    title: 'Completed This Month',
    value: '89',
    trend: { value: 23.1, direction: 'up' },
    icon: <FileText className="text-gray-800 size-6 dark:text-white/90" />,
    color: 'success'
  }
]

export default function LegalMetrics() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
      {legalMetrics.map((metric, index) => (
        <div 
          key={index}
          className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 transition-all hover:shadow-theme-md cursor-pointer"
        >
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800 mb-5">
            {metric.icon}
          </div>

          {/* Content */}
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {metric.title}
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
              </h4>
            </div>
            
            {metric.trend && (
              <Badge 
                variant={metric.trend.direction === 'up' ? 'success' : 'error'}
                size="sm"
                startIcon={
                  metric.trend.direction === 'up' ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )
                }
              >
                {metric.trend.value}%
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}