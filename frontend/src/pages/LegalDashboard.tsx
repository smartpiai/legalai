/**
 * Legal Dashboard Home Page
 * Professional dashboard following TailAdmin patterns
 */
import React from 'react'
import { useAuthStore } from '@/store/auth'
import LegalMetrics from '@/components/dashboard/LegalMetrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/Button'
import { 
  FileText, 
  Plus, 
  Upload, 
  BarChart3, 
  Clock,
  AlertCircle,
  CheckCircle,
  TrendingUp
} from 'lucide-react'

export default function LegalDashboard() {
  const { user } = useAuthStore()

  const recentActivities = [
    {
      id: 1,
      title: 'Service Agreement Updated',
      description: 'Terms and conditions modified',
      time: '2 minutes ago',
      type: 'contract',
      status: 'completed'
    },
    {
      id: 2,
      title: 'New Contract Template Created',
      description: 'NDA template for software vendors',
      time: '1 hour ago',
      type: 'template',
      status: 'pending'
    },
    {
      id: 3,
      title: 'Document Review Completed',
      description: 'Legal compliance check finished',
      time: '3 hours ago',
      type: 'review',
      status: 'completed'
    }
  ]

  const upcomingDeadlines = [
    {
      id: 1,
      contract: 'Microsoft Enterprise Agreement',
      deadline: '2 days',
      priority: 'high'
    },
    {
      id: 2,
      contract: 'AWS Service Contract',
      deadline: '1 week',
      priority: 'medium'
    },
    {
      id: 3,
      contract: 'Legal Services Retainer',
      deadline: '2 weeks',
      priority: 'low'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-md font-bold text-gray-800 dark:text-white/90 mb-2">
            Legal Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Welcome back, {user?.full_name || 'User'}. Here's your legal operations overview.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Reports
          </Button>
          <Button variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <LegalMetrics />

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Recent Activity - Left Column */}
        <div className="col-span-12 xl:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  Recent Activity
                </CardTitle>
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-4 p-4 rounded-lg bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center">
                        {activity.type === 'contract' && <FileText className="w-5 h-5 text-brand-500" />}
                        {activity.type === 'template' && <FileText className="w-5 h-5 text-brand-500" />}
                        {activity.type === 'review' && <CheckCircle className="w-5 h-5 text-success-500" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                          {activity.title}
                        </p>
                        <Badge 
                          variant={activity.status === 'completed' ? 'success' : 'warning'}
                          size="sm"
                        >
                          {activity.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-12 xl:col-span-5 space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <FileText className="w-6 h-6" />
                  <span className="text-xs">New Contract</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Upload className="w-6 h-6" />
                  <span className="text-xs">Upload Doc</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <BarChart3 className="w-6 h-6" />
                  <span className="text-xs">Analytics</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Clock className="w-6 h-6" />
                  <span className="text-xs">Deadlines</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingDeadlines.map((deadline) => (
                  <div key={deadline.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {deadline.contract}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Due in {deadline.deadline}
                      </p>
                    </div>
                    <Badge 
                      variant={
                        deadline.priority === 'high' ? 'error' :
                        deadline.priority === 'medium' ? 'warning' : 'light'
                      }
                      size="sm"
                    >
                      {deadline.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}