import React from 'react'

type Props = {
  title: string
  value: number | string
  delta?: string
  icon?: React.ReactNode
  className?: string
}

export default function AdminStatCard({ title, value, delta, icon, className }: Props) {
  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 ${className || ''}`}>
      <div className="flex items-start gap-4">
        <div className="text-3xl text-red-600 dark:text-red-400">{icon}</div>
        <div className="flex-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
          {delta && <div className="mt-1 text-sm text-green-600 dark:text-green-400">{delta}</div>}
        </div>
      </div>
    </div>
  )
}
