import { useMemo } from 'react';

interface ActivityItem {
  id: string;
  type: 'analysis' | 'recommendation' | 'alert' | 'action';
  content: string;
  timestamp: Date;
  tile?: number;
}

interface AgentActivityProps {
  messages: Array<{
    id: string;
    content: string;
    isUser: boolean;
    timestamp: Date;
  }>;
}

const AgentActivity = ({ messages }: AgentActivityProps) => {
  // Extract activity items from messages
  const activities = useMemo(() => {
    const activityItems: ActivityItem[] = [];
    
    messages.forEach(message => {
      if (!message.isUser) {
        let type: ActivityItem['type'] = 'analysis';
        let tile: number | undefined;
        
        // Determine activity type based on content
        if (message.content.includes('Analysis')) {
          type = 'analysis';
          const tileMatch = message.content.match(/Tile (\d+)/);
          if (tileMatch) {
            tile = parseInt(tileMatch[1]);
          }
        } else if (message.content.includes('RECOMMENDED') || message.content.includes('OPPORTUNITY')) {
          type = 'recommendation';
        } else if (message.content.includes('HIGH RISK') || message.content.includes('WARNING')) {
          type = 'alert';
        } else if (message.content.includes('strategy') || message.content.includes('portfolio')) {
          type = 'action';
        }
        
        activityItems.push({
          id: message.id,
          type,
          content: message.content.split('\n')[0], // First line as summary
          timestamp: message.timestamp,
          tile
        });
      }
    });
    
    return activityItems.slice(-10).reverse(); // Last 10 activities, newest first
  }, [messages]);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'analysis': return '🔍';
      case 'recommendation': return '💡';
      case 'alert': return '⚠️';
      case 'action': return '⚡';
      default: return '📝';
    }
  };

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'analysis': return '#3b82f6';
      case 'recommendation': return '#22c55e';
      case 'alert': return '#ef4444';
      case 'action': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const containerStyle = {
    padding: '16px',
    color: 'white',
    height: '100%',
    overflow: 'auto'
  };

  const itemStyle = (type: ActivityItem['type']) => ({
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    border: `1px solid ${getActivityColor(type)}33`,
    marginBottom: '8px',
    fontSize: '11px'
  });

  return (
    <div style={containerStyle}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Recent Activity</h4>
      
      {activities.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          color: '#888', 
          padding: '32px 16px',
          fontSize: '12px'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
          <div>No recent activity</div>
          <div style={{ fontSize: '10px', marginTop: '4px' }}>
            Start interacting with the agent to see activity here
          </div>
        </div>
      ) : (
        <div>
          {activities.map((activity) => (
            <div key={activity.id} style={itemStyle(activity.type)}>
              <div style={{ 
                fontSize: '14px',
                color: getActivityColor(activity.type)
              }}>
                {getActivityIcon(activity.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 500,
                  marginBottom: '4px',
                  color: '#fff'
                }}>
                  {activity.content.length > 60 
                    ? activity.content.substring(0, 60) + '...'
                    : activity.content
                  }
                </div>
                <div style={{ 
                  fontSize: '10px',
                  color: '#888',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>
                    {activity.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                  {activity.tile && (
                    <span style={{ 
                      background: getActivityColor(activity.type),
                      color: 'white',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      fontSize: '9px'
                    }}>
                      Tile {activity.tile}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {activities.length >= 10 && (
            <div style={{ 
              textAlign: 'center', 
              fontSize: '10px', 
              color: '#666',
              marginTop: '8px'
            }}>
              Showing last 10 activities
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentActivity;