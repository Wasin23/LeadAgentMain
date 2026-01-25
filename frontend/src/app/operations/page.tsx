'use client';

import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UsersIcon, ComputerDesktopIcon, ChartPieIcon, Cog6ToothIcon, BookOpenIcon, XMarkIcon } from '@heroicons/react/24/outline';
import AppLayout from '@/components/AppLayout';
import AgentDirector from '@/components/AgentDirector';
import HelpChat from '@/components/HelpChat';
import api from '@/lib/api';
import { geoOrthographic, geoPath, geoGraticule, geoMercator, geoAlbersUsa } from 'd3-geo';
import { feature } from 'topojson-client';
import dynamic from 'next/dynamic';

// Dynamically import InfoDashboard
const InfoDashboard = dynamic(() => import('@/components/InfoDashboard'), {
  ssr: false
});

// Using Natural Earth 110m world data (simplified for performance)
// This is a simplified TopoJSON representation
const worldData = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "United States" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-125, 50], [-125, 48], [-124, 46], [-123, 45], [-122, 44], [-121, 43],
          [-120, 42], [-119, 41], [-117, 39], [-115, 37], [-114, 36], [-113, 35],
          [-111, 33], [-109, 32], [-106, 31], [-104, 30], [-102, 29], [-100, 28.5],
          [-98, 28], [-96, 28.5], [-95, 29], [-94, 29.5], [-93, 30], [-91, 30],
          [-89, 29], [-88, 29.5], [-87, 30], [-86, 30.5], [-85, 31], [-84, 31],
          [-83, 31], [-82, 30.5], [-81, 30], [-80, 29], [-80, 27], [-80, 26],
          [-80.5, 25], [-81, 24.5], [-82, 25], [-83, 25.5], [-84, 26], [-85, 26.5],
          [-86, 27], [-87, 28], [-88, 28.5], [-89, 28.5], [-90, 28.5], [-91, 29],
          [-92, 29], [-93, 29.5], [-94, 30], [-95, 30], [-96, 30.5], [-97, 31],
          [-98, 31.5], [-99, 32], [-100, 32.5], [-101, 33], [-102, 34], [-103, 35],
          [-104, 36], [-105, 37], [-106, 38], [-107, 39], [-108, 40], [-109, 41],
          [-110, 42], [-111, 43], [-112, 44], [-113, 45], [-114, 46], [-115, 47],
          [-116, 47.5], [-117, 48], [-118, 48.5], [-119, 48.5], [-120, 49],
          [-121, 49], [-122.5, 49], [-123.5, 49], [-124.5, 49], [-125, 50]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Canada" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-141, 69], [-141, 60], [-139, 60], [-137, 59], [-135, 59], [-133, 58],
          [-131, 57], [-129, 56], [-127, 55], [-125, 54], [-123, 53], [-122, 52],
          [-121, 51], [-120, 50], [-119, 49], [-95, 49], [-95, 50], [-94, 51],
          [-93, 52], [-92, 53], [-90, 54], [-88, 55], [-86, 56], [-84, 57],
          [-82, 58], [-80, 59], [-78, 60], [-76, 61], [-74, 62], [-72, 63],
          [-70, 64], [-68, 65], [-66, 66], [-64, 67], [-62, 68], [-60, 69],
          [-58, 70], [-56, 71], [-55, 72], [-60, 75], [-65, 77], [-70, 78],
          [-75, 79], [-80, 80], [-85, 81], [-90, 82], [-95, 82], [-100, 81],
          [-105, 80], [-110, 79], [-115, 78], [-120, 76], [-125, 74], [-130, 72],
          [-135, 70], [-141, 69]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Mexico" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-117, 32], [-115, 32], [-113, 31], [-111, 30], [-109, 29], [-107, 28],
          [-105, 27], [-103, 26], [-101, 25], [-99, 24], [-97, 23], [-95, 22],
          [-93, 21], [-91, 20], [-90, 19], [-89, 18], [-89, 17], [-90, 16],
          [-91, 16], [-92, 16], [-93, 16], [-94, 16.5], [-95, 17], [-96, 17.5],
          [-97, 18], [-98, 18.5], [-99, 19], [-100, 19.5], [-101, 20], [-102, 21],
          [-103, 22], [-104, 23], [-105, 24], [-106, 25], [-107, 26], [-108, 27],
          [-109, 28], [-110, 28.5], [-111, 29], [-112, 29.5], [-113, 30],
          [-114, 30.5], [-115, 31], [-116, 31.5], [-117, 32]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Brazil" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-73, 5], [-70, 3], [-68, 1], [-66, -1], [-64, -3], [-62, -5], [-60, -7],
          [-58, -10], [-57, -13], [-56, -16], [-55, -19], [-54, -22], [-53, -25],
          [-52, -27], [-51, -29], [-50, -31], [-49, -32], [-48, -33], [-47, -33],
          [-46, -33], [-45, -33], [-44, -32], [-43, -31], [-42, -29], [-41, -27],
          [-40, -25], [-39, -23], [-38, -21], [-37, -19], [-36, -17], [-35, -15],
          [-35, -10], [-35, -5], [-36, 0], [-37, 3], [-40, 4], [-43, 4], [-46, 3],
          [-49, 2], [-52, 1], [-55, 0], [-58, -1], [-61, -1], [-64, 0], [-67, 1],
          [-70, 2], [-72, 3.5], [-73, 5]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Russia" },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[[
          [40, 50], [45, 52], [50, 53], [55, 54], [60, 55], [65, 56], [70, 57],
          [75, 58], [80, 59], [85, 60], [90, 61], [95, 62], [100, 63], [105, 64],
          [110, 65], [115, 66], [120, 67], [125, 68], [130, 69], [135, 70],
          [140, 70], [145, 70], [150, 70], [155, 69], [160, 68], [165, 67],
          [170, 66], [175, 65], [180, 64], [180, 70], [175, 72], [170, 74],
          [165, 75], [160, 76], [155, 77], [150, 78], [145, 78], [140, 78],
          [135, 77], [130, 76], [125, 75], [120, 74], [115, 73], [110, 72],
          [105, 71], [100, 70], [95, 69], [90, 68], [85, 67], [80, 66], [75, 65],
          [70, 64], [65, 63], [60, 62], [55, 61], [50, 60], [45, 58], [40, 56],
          [35, 54], [30, 52], [30, 50], [35, 50], [40, 50]
        ]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "China" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [75, 40], [80, 42], [85, 44], [90, 45], [95, 46], [100, 47], [105, 48],
          [110, 49], [115, 50], [120, 51], [123, 52], [125, 53], [127, 53],
          [130, 52], [132, 50], [134, 48], [135, 45], [135, 42], [134, 39],
          [132, 36], [130, 33], [128, 30], [126, 27], [124, 24], [122, 22],
          [120, 20], [118, 19], [115, 19], [112, 20], [110, 22], [108, 24],
          [106, 26], [104, 28], [102, 30], [100, 31], [98, 32], [96, 32],
          [94, 31], [92, 30], [90, 29], [88, 29], [86, 30], [84, 31], [82, 32],
          [80, 33], [78, 35], [76, 37], [75, 40]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Australia" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [113, -22], [115, -24], [117, -26], [119, -28], [121, -30], [123, -32],
          [125, -34], [127, -35], [129, -36], [131, -37], [133, -37.5], [135, -38],
          [137, -38], [139, -37.5], [141, -37], [143, -36], [145, -35], [147, -34],
          [148, -32], [149, -30], [150, -28], [151, -26], [152, -24], [153, -22],
          [153, -20], [153, -18], [153, -16], [153, -14], [152, -12], [151, -11],
          [149, -11], [147, -11.5], [145, -12], [143, -12.5], [141, -13],
          [139, -13], [137, -13], [135, -13], [133, -13.5], [131, -14],
          [129, -14.5], [127, -15], [125, -16], [123, -17], [121, -18], [119, -19],
          [117, -20], [115, -21], [113, -22]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "India" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [68, 35], [70, 36], [72, 36], [74, 35], [76, 34], [78, 33], [80, 32],
          [82, 31], [84, 30], [86, 29], [88, 28], [89, 27], [90, 26], [91, 25],
          [92, 23], [93, 21], [93, 19], [93, 17], [93, 15], [92, 13], [91, 11],
          [90, 9], [89, 8], [87, 8], [85, 9], [83, 10], [81, 11], [79, 12],
          [77, 13], [75, 15], [74, 17], [73, 19], [72, 21], [71, 23], [70, 25],
          [69, 27], [68, 29], [68, 31], [68, 33], [68, 35]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Argentina" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-73, -22], [-71, -24], [-69, -26], [-68, -28], [-67, -30], [-66, -32],
          [-65, -34], [-65, -36], [-65, -38], [-65, -40], [-66, -42], [-67, -44],
          [-68, -46], [-69, -48], [-70, -50], [-71, -52], [-72, -53], [-73, -54],
          [-74, -54], [-73, -53], [-72, -52], [-71, -51], [-70, -50], [-69, -48],
          [-68, -46], [-67, -44], [-66, -42], [-66, -40], [-66, -38], [-67, -36],
          [-68, -34], [-69, -32], [-70, -30], [-71, -28], [-72, -26], [-73, -24],
          [-73, -22]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "South Africa" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [16, -29], [18, -30], [20, -31], [22, -32], [24, -33], [26, -33.5],
          [28, -33.5], [30, -33], [31, -32], [32, -31], [32, -29], [32, -27],
          [31, -25], [30, -23], [29, -22], [27, -22], [25, -23], [23, -24],
          [21, -25], [19, -26], [17, -27], [16, -28], [16, -29]
        ]]
      }
    }
  ]
};

export default function InteractiveGlobe() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState<[number, number]>([95, -15]);
  const rotationRef = useRef<[number, number]>([95, -15]);
  const [targetRotation, setTargetRotation] = useState<[number, number] | null>(null);
  const [isAnimatingToAgent, setIsAnimatingToAgent] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const [worldGeoData, setWorldGeoData] = useState<any>(null);

  // Globe view toggle
  const [showGlobe, setShowGlobe] = useState(false);
  const [globeLoading, setGlobeLoading] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Handle globe toggle with animation
  const handleGlobeToggle = (show: boolean) => {
    if (!show && showGlobe) {
      // Turning off - animate out first
      setIsAnimatingOut(true);
      setTimeout(() => {
        setShowGlobe(false);
        setIsAnimatingOut(false);
      }, 500); // Match transition duration
    } else {
      setShowGlobe(show);
    }
  };

  // When globe is turned on, start loading sequence (useLayoutEffect runs before paint)
  useLayoutEffect(() => {
    if (showGlobe) {
      setIsAnimatingOut(false);
      setGlobeLoading(false);
    } else {
      setGlobeLoading(false);
    }
  }, [showGlobe]);

  // Real stats data
  const [stats, setStats] = useState({
    emailsQueued: 0,
    emailsSent: 0,
    emailsViewed: 0,
    alerts: 0,
    totalEmailsQueued: 0, // Cumulative total for progress bar
    totalEmailsSent: 0    // Cumulative total for progress bar
  });

  // Toast notification state
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Activity Logs state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');
  const activityLogsRef = useRef<Map<string, EventSource>>(new Map());

  // Modal states
  const [selectedQueue, setSelectedQueue] = useState<{agentId: string | 'all', type: 'queued' | 'sent' | 'replied', agentName: string} | null>(null);
  const [queueEmails, setQueueEmails] = useState<any[]>([]);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<{id: string, subject: string, body: string, to: string, cc?: string, bcc?: string} | null>(null);
  const [selectedEmailForView, setSelectedEmailForView] = useState<any | null>(null); // For viewing email details
  const [viewingAiReport, setViewingAiReport] = useState<any | null>(null); // For viewing AI research reports
  const [navigating, setNavigating] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentMetricsHistory, setAgentMetricsHistory] = useState<{[agentId: string]: any[]}>({});
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [currentEmailPage, setCurrentEmailPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 'desc' = latest first, 'asc' = earliest first
  const [fontSize, setFontSize] = useState<number>(11); // Base font size in pixels
  const EMAILS_PER_PAGE = 20;
  const [totalQueuedEmails, setTotalQueuedEmails] = useState(0);
  const [hasMoreEmails, setHasMoreEmails] = useState(false);
  
  // Auto-editor states
  const [showAutoEditor, setShowAutoEditor] = useState(false);
  const [autoEditFind, setAutoEditFind] = useState('');
  const [autoEditReplace, setAutoEditReplace] = useState('');
  const [autoEditUseRegex, setAutoEditUseRegex] = useState(false);
  const [autoEditLoading, setAutoEditLoading] = useState(false);
  const [autoEditProgress, setAutoEditProgress] = useState('');
  
  // Modal drag and resize states
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState({ width: 896, height: 600 }); // max-w-4xl = 896px
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const rafRef = useRef<number | undefined>(undefined);
  const prevShowIdleAgentsRef = useRef(false);

  // Satellite and agent positioning
  const [showIdleAgents, setShowIdleAgents] = useState(false);
  const [satelliteBob, setSatelliteBob] = useState(0);
  const [agentActivities, setAgentActivities] = useState<{[agentId: string]: any}>({});

  // Tab state for operations view
  const [activeTab, setActiveTab] = useState<'director' | 'queue' | 'globe' | 'analytics'>('director');
  const [activityFilter, setActivityFilter] = useState<'all' | 'opened' | 'sent' | 'bounced'>('all');
  const [outreachSearch, setOutreachSearch] = useState('');
  const [outreachPage, setOutreachPage] = useState(0);
  const OUTREACH_PAGE_SIZE = 20;
  
  // AI Summary and cycle tracking
  const [aiSummary, setAiSummary] = useState<string>('Initializing coordination intelligence...');
  const [cycleEvents, setCycleEvents] = useState<Array<{id: string, agentName: string, type: string, message: string, timestamp: number}>>([]);
  const [todayStart, setTodayStart] = useState(new Date().setHours(0, 0, 0, 0));
  const [recentWarnings, setRecentWarnings] = useState<Array<{id: string, severity: string, message: string, agentId?: string, timestamp: number}>>([]);
  
  // Follow-up modal state
  const [followUpModal, setFollowUpModal] = useState<any>(null);
  const [editingFollowUp, setEditingFollowUp] = useState(false);
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [editTemplateId, setEditTemplateId] = useState(0);
  
  // Email location tracking with status (queued, sent, meeting)
  const [emailDots, setEmailDots] = useState<Array<{
    id: string;
    location: { lat: number; lng: number; city?: string; state?: string; country?: string; companyName?: string };
    subject: string;
    to: string;
    agentName: string;
    timestamp: number;
    status: 'queued' | 'sent' | 'meeting';
  }>>([]);
  
  // Canvas size state to prevent hydration mismatch
  const [canvasSize, setCanvasSize] = useState(1200); // Default size for SSR
  const [isMounted, setIsMounted] = useState(false);

  // Track mount to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Track mount to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Mount effect to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Refetch all agents queue when modal closes and "All Agents" is selected
  useEffect(() => {
    console.log('Modal close effect triggered:', {
      prevModalOpen: prevShowIdleAgentsRef.current,
      currentModalOpen: showIdleAgents,
      selectedAgent: selectedAgent,
      selectedQueue: selectedQueue,
      agentsCount: agents.filter(a => a.agentId !== 'orphan').length
    });
    
    // Only run when modal transitions from open to closed
    if (prevShowIdleAgentsRef.current && !showIdleAgents && !selectedAgent && selectedQueue && agents.length > 0) {
      console.log('Refetching all emails for queue:', selectedQueue.type);
      // Refetch all emails when modal closes and we're viewing all agents
      const fetchAllEmails = async () => {
        try {
          const allEmails: any[] = [];
          for (const agent of agents) {
            if (agent.agentId === 'orphan') continue;
            const response = await api.get(`/api/email-queue/${selectedQueue?.type === 'sent' ? 'sent' : selectedQueue?.type === 'replied' ? 'replied' : 'queue'}`, {
              params: { agentId: agent.agentId }
            });
            const emails = Array.isArray(response.data) ? response.data : (response.data.emails || []);
            console.log(`Agent ${agent.name} returned ${emails.length} emails`);
            allEmails.push(...emails.map((email: any) => ({
              ...email,
              agentName: agent.name
            })));
          }
          console.log(`Total emails fetched: ${allEmails.length}`);
          setQueueEmails(allEmails.sort((a, b) => 
            new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          ));
        } catch (error) {
          console.error('Error fetching all emails:', error);
        }
      };
      fetchAllEmails();
    }
    // Update the ref for next time
    prevShowIdleAgentsRef.current = showIdleAgents;
  }, [showIdleAgents, selectedAgent, selectedQueue, agents]);

  // City and state geocoding function with detailed US city coordinates
  const geocodeLocation = (location: any): { lat: number; lng: number } | null => {
    if (!location) return null;
    
    const { city, state, country } = location;
    
    // Major US cities with accurate coordinates
    const cityCenters: {[key: string]: {lat: number, lng: number}} = {
      // California cities
      'Irvine': {lat: 33.6846, lng: -117.8265},
      'Los Angeles': {lat: 34.0522, lng: -118.2437},
      'San Francisco': {lat: 37.7749, lng: -122.4194},
      'San Diego': {lat: 32.7157, lng: -117.1611},
      'San Jose': {lat: 37.3382, lng: -121.8863},
      'Sacramento': {lat: 38.5816, lng: -121.4944},
      'Oakland': {lat: 37.8044, lng: -122.2712},
      'Fresno': {lat: 36.7378, lng: -119.7871},
      'Long Beach': {lat: 33.7701, lng: -118.1937},
      'Santa Clara': {lat: 37.3541, lng: -121.9552},
      'Palo Alto': {lat: 37.4419, lng: -122.1430},
      'Sunnyvale': {lat: 37.3688, lng: -122.0363},
      'Mountain View': {lat: 37.3861, lng: -122.0839},
      'Cupertino': {lat: 37.3230, lng: -122.0322},
      
      // Texas cities
      'Houston': {lat: 29.7604, lng: -95.3698},
      'Dallas': {lat: 32.7767, lng: -96.7970},
      'Austin': {lat: 30.2672, lng: -97.7431},
      'San Antonio': {lat: 29.4241, lng: -98.4936},
      'Fort Worth': {lat: 32.7555, lng: -97.3308},
      
      // Other major cities
      'New York': {lat: 40.7128, lng: -74.0060},
      'Chicago': {lat: 41.8781, lng: -87.6298},
      'Phoenix': {lat: 33.4484, lng: -112.0740},
      'Philadelphia': {lat: 39.9526, lng: -75.1652},
      'Miami': {lat: 25.7617, lng: -80.1918},
      'Atlanta': {lat: 33.7490, lng: -84.3880},
      'Boston': {lat: 42.3601, lng: -71.0589},
      'Seattle': {lat: 47.6062, lng: -122.3321},
      'Denver': {lat: 39.7392, lng: -104.9903},
      'Washington': {lat: 38.9072, lng: -77.0369},
      'Detroit': {lat: 42.3314, lng: -83.0458},
      'Portland': {lat: 45.5152, lng: -122.6784},
      'Las Vegas': {lat: 36.1699, lng: -115.1398},
    };
    
    // Try to find city first (more accurate)
    if (city && cityCenters[city]) {
      return cityCenters[city];
    }
    
    // Fall back to state centers
    const stateCenters: {[key: string]: {lat: number, lng: number}} = {
      'California': {lat: 36.7783, lng: -119.4179}, 'CA': {lat: 36.7783, lng: -119.4179},
      'Texas': {lat: 31.9686, lng: -99.9018}, 'TX': {lat: 31.9686, lng: -99.9018},
      'Florida': {lat: 27.6648, lng: -81.5158}, 'FL': {lat: 27.6648, lng: -81.5158},
      'New York': {lat: 40.7128, lng: -74.0060}, 'NY': {lat: 40.7128, lng: -74.0060},
      'Pennsylvania': {lat: 41.2033, lng: -77.1945}, 'PA': {lat: 41.2033, lng: -77.1945},
      'Illinois': {lat: 40.6331, lng: -89.3985}, 'IL': {lat: 40.6331, lng: -89.3985},
      'Ohio': {lat: 40.4173, lng: -82.9071}, 'OH': {lat: 40.4173, lng: -82.9071},
      'Georgia': {lat: 32.1656, lng: -82.9001}, 'GA': {lat: 32.1656, lng: -82.9001},
      'North Carolina': {lat: 35.7596, lng: -79.0193}, 'NC': {lat: 35.7596, lng: -79.0193},
      'Michigan': {lat: 44.3148, lng: -85.6024}, 'MI': {lat: 44.3148, lng: -85.6024},
      'Massachusetts': {lat: 42.4072, lng: -71.3824}, 'MA': {lat: 42.4072, lng: -71.3824},
      'Washington': {lat: 47.7511, lng: -120.7401}, 'WA': {lat: 47.7511, lng: -120.7401},
      'Colorado': {lat: 39.5501, lng: -105.7821}, 'CO': {lat: 39.5501, lng: -105.7821},
      'Arizona': {lat: 34.0489, lng: -111.0937}, 'AZ': {lat: 34.0489, lng: -111.0937},
      'Virginia': {lat: 37.4316, lng: -78.6569}, 'VA': {lat: 37.4316, lng: -78.6569},
    };
    
    // Try state first
    if (state && stateCenters[state]) {
      return stateCenters[state];
    }
    
    // Default to central US if no specific location
    return { lat: 39.8283, lng: -98.5795 };
  };

  // Set canvas size on mount to prevent hydration mismatch
  useEffect(() => {
    const updateCanvasSize = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        let size;
        if (width < 640) {
          // Mobile: Use 90% of screen width or max 450px
          size = Math.min(width * 0.9, 450);
        } else if (width < 768) {
          // Small tablet
          size = 500;
        } else if (width < 1024) {
          // Tablet
          size = 600;
        } else if (width < 1280) {
          // Small laptop (mom's Mac) - scale down proportionally
          size = Math.min(700, width * 0.6);
        } else if (width < 1536) {
          // Medium desktop
          size = Math.min(800, width * 0.55);
        } else {
          // Large desktop
          size = Math.min(950, width * 0.5);
        }
        setCanvasSize(size);
        setIsMounted(true);
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Animate satellite bobbing
  useEffect(() => {
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.05;
      setSatelliteBob(Math.sin(angle) * 10); // Bobs up and down 10px
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Poll AI summary every 5 seconds
  useEffect(() => {
    if (!isMounted || activeTab !== 'director') return;
    
    const fetchSummary = async () => {
      try {
        const response = await api.get('/api/monitoring/ai-summary');
        if (response.data?.summary) {
          setAiSummary(response.data.summary);
        }
      } catch (error) {
        console.error('Failed to fetch AI summary:', error);
      }
    };
    
    fetchSummary(); // Initial fetch
    const interval = setInterval(fetchSummary, 5000);
    return () => clearInterval(interval);
  }, [isMounted, activeTab]);

  // Check if we need to reset today's stats
  useEffect(() => {
    const checkDateReset = () => {
      const now = new Date().setHours(0, 0, 0, 0);
      if (now > todayStart) {
        setTodayStart(now);
        // Reset stats
        setStats(prev => ({
          ...prev,
          totalEmailsQueued: 0,
          totalEmailsSent: 0
        }));
      }
    };
    
    checkDateReset();
    const interval = setInterval(checkDateReset, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [todayStart]);

  // Connect to SSE for agent activities
  useEffect(() => {
    if (!isMounted) return;
    
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const authToken = localStorage.getItem('authToken');
    const eventSource = new EventSource(`${backendUrl}/api/monitoring/stream?token=${encodeURIComponent(authToken || '')}`);
    
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 SSE Event received:', data);
        
        // Handle cycle events for progress stream (check both direct and wrapped)
        const eventType = data.type === 'activity_added' && data.data?.type ? data.data.type : data.type;
        const eventData = data.type === 'activity_added' && data.data ? data.data : data;
        
        if (eventType === 'cycle_complete' || eventType === 'cycle_start') {
          const agent = agents.find(a => a.agentId === eventData.agentId);
          const agentName = agent?.name || 'Agent';
          const cycleEvent = {
            id: `cycle-${Date.now()}-${Math.random()}`,
            agentName,
            type: eventType,
            message: eventType === 'cycle_complete' 
              ? `Completed Cycle #${eventData.cycleNumber} → ${eventData.leadsFound || 0} leads found, ${eventData.qualified || 0} qualified`
              : `Started Cycle #${eventData.cycleNumber} → Targeting: ${eventData.targeting || 'Mixed'}`,
            timestamp: Date.now()
          };
          setCycleEvents(prev => [cycleEvent, ...prev].slice(0, 50)); // Keep last 50
        }
        
        // Handle issue/warning events
        if (data.type === 'issue_detected' || data.type === 'activity_added') {
          const issueData = data.type === 'issue_detected' ? data : 
                           (data.data?.type === 'issue' || data.data?.severity) ? data.data : null;
          
          if (issueData && (issueData.severity === 'error' || issueData.severity === 'warning')) {
            const warning = {
              id: issueData.id || `warning-${Date.now()}-${Math.random()}`,
              severity: issueData.severity,
              message: issueData.message || issueData.details || 'Unknown issue',
              agentId: issueData.agentId,
              timestamp: Date.now()
            };
            setRecentWarnings(prev => [warning, ...prev].slice(0, 10)); // Keep last 10
          }
        }
        
        // Handle agent stopped event
        if (data.type === 'activity_added' && data.data?.type === 'agent_stopped') {
          const stopData = data.data;
          console.log('🛑 Agent stopped event received:', stopData);
          
          // Clear agent activity
          setAgentActivities(prev => {
            const newActivities = { ...prev };
            delete newActivities[stopData.agentId];
            return newActivities;
          });
          
          // Update agent status to idle
          setAgents(prev => prev.map(agent => 
            agent.agentId === stopData.agentId
              ? { ...agent, status: 'idle', currentActivity: null }
              : agent
          ));
          
          return; // Don't process as normal activity
        }
        
        const activityData = data.type === 'agent_activity' ? data : 
                            (data.type === 'activity_added' && data.data?.type === 'agent_activity') ? data.data : 
                            null;
        
        if (activityData && activityData.agentId) {
          setAgentActivities(prev => ({
            ...prev,
            [activityData.agentId]: {
              status: activityData.cardMessage || activityData.details,
              timestamp: Date.now(),
              location: activityData.location || null,
              targeting: activityData.targeting || null,
              isActive: true
            }
          }));

          // Update agent in agents list
          setAgents(prev => prev.map(agent => 
            agent.agentId === activityData.agentId
              ? { 
                  ...agent, 
                  currentActivity: activityData.cardMessage || activityData.details, 
                  status: 'running',
                  lastActivity: Date.now()
                }
              : agent
          ));
          
          // Check if this is an email built activity - store location with status
          if (activityData.operation === 'Email Processing' || 
              activityData.cardMessage?.includes('✍️ Writing') || 
              activityData.details?.includes('Email built') ||
              activityData.details?.includes('✅ Email built')) {
            console.log('📧 Email built detected!', {
              operation: activityData.operation,
              details: activityData.details,
              hasLocation: !!activityData.location,
              location: activityData.location
            });
            
            if (activityData.location) {
              const coords = geocodeLocation(activityData.location);
              console.log('📍 Geocoded coordinates:', coords);
              if (coords) {
                const agent = agents.find(a => a.agentId === activityData.agentId);
                console.log('📌 Adding email dot for agent:', agent?.name);
                setEmailDots(prev => {
                  const newDot = {
                    id: `${activityData.agentId}_${Date.now()}`,
                    location: {
                      ...coords,
                      city: activityData.location.city,
                      state: activityData.location.state,
                      country: activityData.location.country,
                      companyName: activityData.location.companyName
                    },
                    subject: activityData.details || 'Email queued',
                    to: activityData.targeting?.company || activityData.location.companyName || 'Unknown',
                    agentName: agent?.name || 'Agent',
                    timestamp: Date.now(),
                    status: 'queued' as const
                  };
                  console.log('✅ New email dot:', newDot);
                  return [...prev, newDot];
                });
              }
            } else {
              console.log('⚠️ No location data in activity');
            }
          }
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    });

    return () => eventSource.close();
  }, [agents, isMounted]);

  // Debug idle agents
  useEffect(() => {
    console.log('All agents:', agents.map(a => ({
      name: a.name,
      status: a.status,
      agentId: a.agentId,
      hasActivity: !!agentActivities[a.agentId],
      isActive: agentActivities[a.agentId]?.isActive,
      shouldBeIdle: !agentActivities[a.agentId]?.isActive || a.status !== 'running'
    })));
    const idleAgents = agents.filter(a => !agentActivities[a.agentId]?.isActive && a.status !== 'running');
    console.log('Idle agents count:', idleAgents.length);
    console.log('Idle agents:', idleAgents.map(a => ({
      name: a.name,
      status: a.status,
      hasActivity: !!agentActivities[a.agentId],
      isActive: agentActivities[a.agentId]?.isActive
    })));
  }, [agents, agentActivities]);

  // Fetch agents list
  const fetchAgents = async (queueType?: 'queued' | 'sent' | 'replied') => {
    setLoadingAgents(true);
    try {
      const response = await api.get('/api/auth/agents');
      console.log('Fetched agents:', response.data.agents);
      console.log('Agent activities:', agentActivities);
      let agents = response.data.agents || [];
      console.log('Agents status check:', agents.map((a: any) => ({
        name: a.name,
        status: a.status,
        agentId: a.agentId,
        hasActivity: !!agentActivities[a.agentId],
        isActive: agentActivities[a.agentId]?.isActive,
        useGmail: a.settings?.emailSettings?.useGmail,
        hasEmailSettings: !!a.settings?.emailSettings
      })));
      
      // Enrich agents with queue stats using efficient count endpoints
      const enrichedAgents = await Promise.all(
        agents.map(async (agent: any) => {
          if (agent.agentId === 'orphan') return agent;
          try {
            const [queueRes, sentRes, repliedRes] = await Promise.all([
              api.get(`/api/email-queue/queue/count?agentId=${agent.agentId}`),
              api.get(`/api/email-queue/sent/count?agentId=${agent.agentId}`),
              api.get(`/api/email-queue/replied/count?agentId=${agent.agentId}`)
            ]);
            const queuedCount = queueRes.data?.count || 0;
            const sentCount = sentRes.data?.count || 0;
            const repliedCount = repliedRes.data?.count || 0;
            
            return {
              ...agent,
              queued: queuedCount,
              sent: sentCount,
              replied: repliedCount
            };
          } catch (error) {
            console.error(`Error fetching stats for ${agent.name}:`, error);
            return { ...agent, queued: 0, sent: 0, replied: 0 };
          }
        })
      );
      
      agents = enrichedAgents;
      
      // Always check for orphaned emails (queued, sent, and replied) using count endpoints
      try {
        const [orphanedQueuedRes, orphanedSentRes, orphanedRepliedRes] = await Promise.all([
          api.get('/api/email-queue/queue/count?agentId=orphan'),
          api.get('/api/email-queue/sent/count?agentId=orphan'),
          api.get('/api/email-queue/replied/count?agentId=orphan')
        ]);
        
        const orphanedQueuedCount = orphanedQueuedRes.data?.count || 0;
        const orphanedSentCount = orphanedSentRes.data?.count || 0;
        const orphanedRepliedCount = orphanedRepliedRes.data?.count || 0;
        
        console.log('Orphaned emails check:', orphanedQueuedCount, 'queued,', orphanedSentCount, 'sent,', orphanedRepliedCount, 'replied');
        
        if (orphanedQueuedCount > 0 || orphanedSentCount > 0) {
          // Add orphaned emails as a special agent at the top
          agents = [{
            agentId: 'orphan',
            name: 'Orphaned Emails',
            status: 'orphaned',
            isOrphaned: true,
            queued: orphanedQueuedCount,
            sent: orphanedSentCount,
            replied: orphanedRepliedCount
          }, ...agents];
          console.log('Added orphaned emails agent to list');
        }
      } catch (error) {
        console.error('Error fetching orphaned emails:', error);
      }
      
      setAgents(agents);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  // Fetch historical metrics for all agents
  const fetchMetricsHistory = async () => {
    try {
      const response = await api.get('/api/agent-metrics/history?hours=12');
      const metricsData: {[agentId: string]: any[]} = {};
      
      response.data.agents.forEach((agent: any) => {
        metricsData[agent.agentId] = agent.history || [];
      });
      
      setAgentMetricsHistory(metricsData);
      console.log('📊 Fetched metrics history:', metricsData);
    } catch (error) {
      console.error('Error fetching metrics history:', error);
    }
  };



  // Fetch queue emails when agent is selected
  const fetchQueueEmails = async (agentId: string, type: 'queued' | 'sent' | 'replied') => {
    setLoadingQueue(true);
    setCurrentEmailPage(1); // Reset to first page when fetching new emails
    try {
      let endpoint = '';
      const offset = 0; // Always start from first page on new fetch
      const limit = EMAILS_PER_PAGE;
      
      if (type === 'queued') {
        endpoint = `/api/email-queue/queue?agentId=${agentId}&limit=${limit}&offset=${offset}`;
      } else if (type === 'sent') {
        endpoint = `/api/email-queue/sent?agentId=${agentId}`;
      } else if (type === 'replied') {
        endpoint = `/api/email-queue/replied?agentId=${agentId}`;
      }
      
      const response = await api.get(endpoint);
      
      // Handle paginated response for queued emails
      if (type === 'queued' && response.data && typeof response.data === 'object' && 'emails' in response.data) {
        const { emails, total, hasMore } = response.data;
        setQueueEmails(Array.isArray(emails) ? emails : []);
        setTotalQueuedEmails(total || 0);
        setHasMoreEmails(hasMore || false);
      } else {
        // Handle non-paginated response for sent/replied
        const emails = Array.isArray(response.data) ? response.data : [];
        setQueueEmails(emails);
        setTotalQueuedEmails(emails.length);
        setHasMoreEmails(false);
      }
      
      // Debug: Log follow-up data for sent emails
      if (type === 'sent' && response.data.length > 0) {
        console.log('📅 [FOLLOW-UP DEBUG] Fetched sent emails:', response.data.length);
        const emailsWithFollowUp = response.data.filter((e: any) => e.followUpScheduled || e.followUpDate);
        console.log('📅 [FOLLOW-UP DEBUG] Emails with follow-up data:', emailsWithFollowUp.length);
        if (emailsWithFollowUp.length > 0) {
          console.log('📅 [FOLLOW-UP DEBUG] Sample email with follow-up:', {
            id: emailsWithFollowUp[0].id,
            followUpScheduled: emailsWithFollowUp[0].followUpScheduled,
            followUpDate: emailsWithFollowUp[0].followUpDate,
            assignedTemplateId: emailsWithFollowUp[0].assignedTemplateId
          });
        }
      }
    } catch (error) {
      console.error('Error fetching queue emails:', error);
      setQueueEmails([]);
      setTotalQueuedEmails(0);
      setHasMoreEmails(false);
    } finally {
      setLoadingQueue(false);
    }
  };

  // Fetch paginated emails when page changes
  const fetchEmailPage = async (page: number) => {
    if (!selectedAgent) return;
    
    setLoadingQueue(true);
    try {
      const offset = (page - 1) * EMAILS_PER_PAGE;
      const limit = EMAILS_PER_PAGE;
      const agentId = selectedAgent.agentId;
      const type = selectedQueue?.type || 'queued';
      
      let endpoint = '';
      if (type === 'queued') {
        endpoint = `/api/email-queue/queue?agentId=${agentId}&limit=${limit}&offset=${offset}`;
      } else if (type === 'sent') {
        endpoint = `/api/email-queue/sent?agentId=${agentId}`;
      } else if (type === 'replied') {
        endpoint = `/api/email-queue/replied?agentId=${agentId}`;
      }
      
      const response = await api.get(endpoint);
      
      // Handle paginated response for queued emails
      if (type === 'queued' && response.data && typeof response.data === 'object' && 'emails' in response.data) {
        const { emails, total, hasMore } = response.data;
        setQueueEmails(Array.isArray(emails) ? emails : []);
        setTotalQueuedEmails(total || 0);
        setHasMoreEmails(hasMore || false);
      } else {
        // Handle non-paginated response for sent/replied
        const emails = Array.isArray(response.data) ? response.data : [];
        setQueueEmails(emails);
        setTotalQueuedEmails(emails.length);
        setHasMoreEmails(false);
      }
    } catch (error) {
      console.error('Error fetching email page:', error);
      setQueueEmails([]);
      setTotalQueuedEmails(0);
      setHasMoreEmails(false);
    } finally {
      setLoadingQueue(false);
    }
  };

  // Modal drag handlers
  const handleModalMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    setIsDraggingModal(true);
    setDragStart({ x: e.clientX - modalPosition.x, y: e.clientY - modalPosition.y });
  };

  const handleModalMouseMove = (e: MouseEvent) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (isDraggingModal) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        // Constrain to viewport boundaries (8px padding)
        const maxX = window.innerWidth - modalSize.width - 8;
        const maxY = window.innerHeight - modalSize.height - 8;
        
        setModalPosition({
          x: Math.max(8, Math.min(maxX, newX)),
          y: Math.max(8, Math.min(maxY, newY))
        });
      }
      if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;
        
        // Resize based on direction - only change dimensions in the direction being dragged
        if (resizeDirection.includes('e')) {
          // Right edge: only increase width to the right
          const maxWidth = window.innerWidth - resizeStart.posX - 8;
          newWidth = Math.max(400, Math.min(maxWidth, resizeStart.width + deltaX));
        }
        if (resizeDirection.includes('w')) {
          // Left edge: increase width to the left by moving position
          const maxLeftMove = resizeStart.posX - 8;
          const actualDelta = Math.max(-maxLeftMove, deltaX);
          newWidth = Math.max(400, Math.min(window.innerWidth - 16, resizeStart.width - actualDelta));
          newX = resizeStart.posX + resizeStart.width - newWidth;
        }
        if (resizeDirection.includes('s')) {
          // Bottom edge: only increase height downward
          const maxHeight = window.innerHeight - resizeStart.posY - 8;
          newHeight = Math.max(300, Math.min(maxHeight, resizeStart.height + deltaY));
        }
        if (resizeDirection.includes('n')) {
          // Top edge: increase height upward by moving position
          const maxUpMove = resizeStart.posY - 8;
          const actualDelta = Math.max(-maxUpMove, deltaY);
          newHeight = Math.max(300, Math.min(window.innerHeight - 16, resizeStart.height - actualDelta));
          newY = resizeStart.posY + resizeStart.height - newHeight;
        }
        
        setModalSize({ width: newWidth, height: newHeight });
        setModalPosition({ x: newX, y: newY });
      }
    });
  };

  const handleModalMouseUp = () => {
    setIsDraggingModal(false);
    setIsResizing(false);
  };

  const handleResizeMouseDown = (direction: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: modalSize.width,
      height: modalSize.height,
      posX: modalPosition.x,
      posY: modalPosition.y
    });
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDraggingModal || isResizing) {
      window.addEventListener('mousemove', handleModalMouseMove);
      window.addEventListener('mouseup', handleModalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleModalMouseMove);
        window.removeEventListener('mouseup', handleModalMouseUp);
      };
    }
  }, [isDraggingModal, isResizing, dragStart, resizeStart, modalPosition, modalSize, resizeDirection]);

  const handleQueueClick = (type: 'queued' | 'sent' | 'replied', label: string) => {
    // Reset loading states immediately
    setLoadingAgents(false);
    setLoadingQueue(false);
    
    setSelectedQueue({ agentId: 'all', type, agentName: label });
    setSelectedAgent(null);
    // Reset modal position and size when opening - center it on screen
    const centerX = (window.innerWidth - 896) / 2;
    const centerY = (window.innerHeight - 600) / 2;
    setModalPosition({ x: Math.max(8, centerX), y: Math.max(8, centerY) });
    setModalSize({ width: 896, height: 600 });
    fetchAgents(type);
    // Actually fetch the queue emails for display
    fetchQueueEmails('all', type);
  };

  const handleAgentSelect = (agent: any) => {
    if (!selectedQueue) return;
    setLoadingQueue(true); // Set loading immediately
    setSelectedAgent(agent);
    fetchQueueEmails(agent.agentId, selectedQueue.type);
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
    setQueueEmails([]);
  };

  const handleApproveEmail = async (emailId: string) => {
    if (!selectedQueue || !selectedAgent) return;
    
    // Optimistic update - remove email immediately from queue
    setQueueEmails(prev => prev.filter(e => (e._id || e.id) !== emailId));
    setStats(prev => ({
      ...prev,
      emailsQueued: Math.max(0, prev.emailsQueued - 1),
      emailsSent: prev.emailsSent + 1,
      totalEmailsSent: prev.totalEmailsSent + 1 // Increment cumulative total
    }));
    
    try {
      // For orphaned emails, use the original agent ID from the email or 'orphan'
      const agentIdToUse = selectedAgent.agentId === 'orphan' ? 'orphan' : selectedAgent.agentId;
      
      await api.post(`/api/email-queue/${emailId}/approve`, {
        agentId: agentIdToUse,
        isOrphaned: selectedAgent.agentId === 'orphan'
      });
      showToast('Email sent successfully! 🚀', 'success');
      
      // Refresh sent emails to get the updated data with follow-up info
      // Wait a moment for backend to process
      setTimeout(() => {
        if (selectedQueue.type === 'sent' || selectedAgent) {
          fetchQueueEmails(selectedAgent.agentId, 'sent');
        }
      }, 1000);
    } catch (error) {
      console.error('Error approving email:', error);
      showToast('Failed to send email', 'error');
      // Revert on error
      fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
      const [queuedResponse, sentResponse] = await Promise.all([
        api.get('/api/email-queue/queue/count?agentId=all'),
        api.get('/api/email-queue/sent?agentId=all')
      ]);
      setStats(prev => ({
        ...prev,
        emailsQueued: queuedResponse.data?.count || 0,
        emailsSent: Array.isArray(sentResponse.data) ? sentResponse.data.length : 0
      }));
    }
  };

  const handleRejectEmail = async (emailId: string) => {
    if (!selectedQueue || !selectedAgent) return;
    
    // Optimistic update - remove email immediately
    setQueueEmails(prev => prev.filter(e => (e._id || e.id) !== emailId));
    setStats(prev => ({
      ...prev,
      emailsQueued: Math.max(0, prev.emailsQueued - 1)
      // totalEmailsQueued stays the same - rejection doesn't change cumulative total
    }));
    
    try {
      await api.delete(`/api/email-queue/${emailId}`, {
        data: { agentId: selectedAgent.agentId }
      });
    } catch (error) {
      console.error('Error rejecting email:', error);
      // Revert on error
      fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
      const queuedResponse = await api.get('/api/email-queue/queue/count?agentId=all');
      setStats(prev => ({
        ...prev,
        emailsQueued: queuedResponse.data?.count || 0
      }));
    }
  };

  const handleAcceptEmail = async (emailId: string, agentId: string) => {
    // Optimistic update - remove email immediately from queue
    setQueueEmails(prev => prev.filter(e => (e._id || e.id) !== emailId));
    setStats(prev => ({
      ...prev,
      emailsQueued: Math.max(0, prev.emailsQueued - 1),
      emailsSent: prev.emailsSent + 1,
      totalEmailsSent: prev.totalEmailsSent + 1
    }));
    
    // Show immediate feedback
    showToast('Email sent successfully! 🚀', 'success');
    
    try {
      await api.post(`/api/email-queue/${emailId}/approve`, { agentId });
      
      // Refresh sent emails after a moment to get follow-up data
      setTimeout(() => {
        if (selectedQueue?.type === 'sent' || selectedAgent) {
          fetchQueueEmails(selectedAgent?.agentId || agentId, 'sent');
        }
      }, 1000);
    } catch (error) {
      console.error('Error accepting email:', error);
      showToast('Failed to send email', 'error');
      // Revert on error
      fetchQueueEmails(agentId, selectedQueue?.type || 'queued');
      const [queuedResponse, sentResponse] = await Promise.all([
        api.get('/api/email-queue/queue/count?agentId=all'),
        api.get('/api/email-queue/sent?agentId=all')
      ]);
      setStats(prev => ({
        ...prev,
        emailsQueued: queuedResponse.data?.count || 0,
        emailsSent: Array.isArray(sentResponse.data) ? sentResponse.data.length : 0
      }));
    }
  };

  const handleRejectEmailFromQueue = async (emailId: string, agentId: string) => {
    // Optimistic update - remove email immediately
    setQueueEmails(prev => prev.filter(e => (e._id || e.id) !== emailId));
    setStats(prev => ({
      ...prev,
      emailsQueued: Math.max(0, prev.emailsQueued - 1)
    }));
    
    // Show immediate feedback
    showToast('Email rejected', 'success');
    
    try {
      await api.delete(`/api/email-queue/${emailId}`, {
        data: { agentId }
      });
    } catch (error) {
      console.error('Error rejecting email:', error);
      showToast('Failed to reject email', 'error');
      // Revert on error
      fetchQueueEmails(agentId, selectedQueue?.type || 'queued');
      const queuedResponse = await api.get('/api/email-queue/queue/count?agentId=all');
      setStats(prev => ({
        ...prev,
        emailsQueued: queuedResponse.data?.count || 0
      }));
    }
  };

  const handleBulkEdit = async () => {
    if (!autoEditFind && autoEditFind !== '') {
      alert('Please enter text to find');
      return;
    }
    
    setAutoEditLoading(true);
    setAutoEditProgress('Preparing to edit emails...');
    
    try {
      const response = await api.post('/api/email-queue/bulk-edit', {
        findText: autoEditFind,
        replaceText: autoEditReplace || '',
        useRegex: autoEditUseRegex,
        agentId: selectedAgent?.agentId || 'all'
      });
      
      if (response.data.success) {
        setAutoEditProgress(`✅ Complete! Updated ${response.data.updatedCount} of ${response.data.totalProcessed} emails`);
        
        // Show success message for 2 seconds then close
        setTimeout(() => {
          setShowAutoEditor(false);
          setAutoEditFind('');
          setAutoEditReplace('');
          setAutoEditProgress('');
          
          // Refresh the queue
          if (selectedAgent && selectedQueue) {
            fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error in bulk edit:', error);
      setAutoEditProgress('❌ Failed: ' + (error.response?.data?.error || error.message));
      
      // Clear error after 3 seconds
      setTimeout(() => {
        setAutoEditProgress('');
        setAutoEditLoading(false);
      }, 3000);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all counts efficiently using count endpoints
        const [queuedResponse, sentResponse, repliedResponse] = await Promise.all([
          api.get('/api/email-queue/queue/count?agentId=all'),
          api.get('/api/email-queue/sent/count?agentId=all'),
          api.get('/api/email-queue/replied/count?agentId=all')
        ]);
        
        const emailsQueued = queuedResponse.data?.count || 0;
        const emailsSent = sentResponse.data?.count || 0;
        const emailsViewed = repliedResponse.data?.count || 0;

        // TODO: Fetch alerts from your alerts API
        const alerts = 0;

        setStats(prev => ({
          emailsQueued,
          emailsSent,
          emailsViewed,
          alerts,
          // Initialize cumulative totals on first load, otherwise keep existing values
          totalEmailsQueued: Math.max(prev.totalEmailsQueued, emailsQueued),
          totalEmailsSent: Math.max(prev.totalEmailsSent, emailsSent)
        }));
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Keep rotationRef in sync with rotation state
  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  // Fetch agents and metrics history on mount
  useEffect(() => {
    fetchAgents('queued');
    fetchMetricsHistory();
  }, []);

  // Refetch agents when page becomes visible (when user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refetching agents...');
        fetchAgents();
        fetchMetricsHistory();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Setup SSE connection for activity logs when on director tab
  useEffect(() => {
    if (activeTab !== 'director') {
      // Cleanup when leaving director tab
      activityLogsRef.current.forEach((source) => source.close());
      activityLogsRef.current.clear();
      return;
    }

    // Setup SSE for each agent
    const setupActivityStreams = () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        
        // Close any existing connections
        activityLogsRef.current.forEach((source) => source.close());
        activityLogsRef.current.clear();
        
        // Connect to each active agent's stream
        agents.filter(a => a.agentId !== 'orphan').forEach(agent => {
          const streamUrl = `${backendUrl}/api/lead-agent/progress-stream?token=${encodeURIComponent(authToken || '')}&agentId=${encodeURIComponent(agent.agentId)}`;
          console.log(`🔌 Connecting to activity stream for agent ${agent.name}:`, streamUrl);
          
          const eventSource = new EventSource(streamUrl);
          activityLogsRef.current.set(agent.agentId, eventSource);
          
          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log(`📨 Received SSE event from ${agent.name}:`, data);
              
              // Only process progress events with agent activity data
              if (data.type === 'progress') {
                const log = data.data || data;
                console.log('🔄 Processing activity log:', log);
                
                // Add agentId to the log if not present
                if (!log.agentId) {
                  log.agentId = agent.agentId;
                }
                
                // Transform technical operations into user-friendly messages
                const friendlyLog = transformActivityLog(log);
                console.log('✨ Transformed log:', friendlyLog);
                
                if (friendlyLog) {
                  setActivityLogs(prev => {
                    const newLogs = [friendlyLog, ...prev.slice(0, 99)];
                    console.log('📋 Updated activity logs count:', newLogs.length);
                    return newLogs;
                  });
                }
              }
            } catch (error) {
              console.error('Error parsing activity log:', error);
            }
          };
          
          eventSource.onerror = (error) => {
            console.error(`Activity stream connection error for ${agent.name}:`, error);
            eventSource.close();
            activityLogsRef.current.delete(agent.agentId);
          };
        });
      } catch (error) {
        console.error('Error setting up activity streams:', error);
      }
    };

    setupActivityStreams();

    return () => {
      activityLogsRef.current.forEach((source) => source.close());
      activityLogsRef.current.clear();
    };
  }, [activeTab, agents]);

  // Transform technical log operations into user-friendly messages
  const transformActivityLog = (log: any) => {
    if (!log || !log.operation) return null;

    const agentName = agents.find(a => a.agentId === log.agentId)?.name || 'Agent';
    const agentPersonality = agents.find(a => a.agentId === log.agentId)?.personality?.type || 'hunter';
    
    let friendlyMessage = '';
    let icon = '🤖';
    let category = 'general';

    // Map technical operations to friendly messages
    if (log.operation === '🎬 Process Starting' || log.message?.includes('Starting')) {
      friendlyMessage = `${agentName} is initializing and preparing to search for leads`;
      icon = '🎬';
      category = 'initialization';
    } else if (log.operation === '🔍 Web Research' || log.operation === 'Deep Research' || log.message?.includes('Researching') || log.message?.includes('research')) {
      const company = log.details?.company || log.data?.company || log.message?.match(/researching (.+?)(?:\sto|$)/i)?.[1] || 'company';
      const purpose = log.details?.purpose || log.data?.purpose;
      
      // Check for 3rd research phase (industry statistics)
      if (purpose === 'industry_statistics' || log.message?.includes('industry statistics') || log.message?.includes('third-party data')) {
        const industry = log.details?.industry || log.data?.industry || '';
        friendlyMessage = industry 
          ? `${agentName} is gathering ${industry} industry statistics and third-party data`
          : `${agentName} is gathering industry statistics and third-party data`;
        icon = '📊';
      } 
      // Check for company success research (4th phase)
      else if (purpose === 'user_company_success' || log.message?.includes('company success')) {
        friendlyMessage = `${agentName} is researching recent company wins for social proof`;
        icon = '🏆';
      }
      // Regular company research
      else {
        friendlyMessage = `${agentName} is researching ${company}`;
        icon = '🔍';
      }
      category = 'research';
    } else if (log.operation === 'pre_qualify' || log.message?.includes('pre-qualify') || log.message?.includes('Qualifying')) {
      const leadName = log.details?.leadName || log.data?.leadName || 'lead';
      friendlyMessage = `${agentName} is qualifying lead: ${leadName}`;
      icon = '🎯';
      category = 'qualification';
    } else if (log.message?.includes('qualified') || log.message?.includes('Qualified')) {
      const leadName = log.details?.leadName || log.data?.leadName || 'Lead';
      const qualified = log.details?.qualified !== false;
      friendlyMessage = qualified 
        ? `${agentName} marked ${leadName} as qualified`
        : `${agentName} marked ${leadName} as not qualified`;
      icon = qualified ? '✅' : '❌';
      category = 'qualification';
    } 
    // Email building/writing
    else if (log.operation === '✍️ Email Generation' || log.message?.includes('Writing personalized email') || log.message?.includes('email for')) {
      // Extract lead name from various possible formats
      const leadName = log.details?.leadName || log.data?.leadName || log.message?.match(/for (.+?) at/)?.[1] || 'lead';
      const company = log.details?.company || log.data?.company || log.message?.match(/at (.+)/)?.[1] || '';
      friendlyMessage = company 
        ? `${agentName} is writing email for ${leadName} at ${company}`
        : `${agentName} is writing personalized email to ${leadName}`;
      icon = '✍️';
      category = 'email';
    } 
    else if (log.operation === 'Email Queued' || log.message?.includes('Queued')) {
      const leadName = log.details?.to || log.data?.to || 'lead';
      friendlyMessage = `${agentName} added email to ${leadName} to queue for approval`;
      icon = '📧';
      category = 'email';
    } else if (log.message?.includes('CRM') || log.message?.includes('contact')) {
      const leadName = log.details?.leadName || log.data?.leadName || 'lead';
      const hasCRM = log.details?.hasCRM !== false;
      friendlyMessage = hasCRM
        ? `${agentName} deposited ${leadName} into CRM`
        : `${agentName} couldn't deposit ${leadName} - No CRM connected`;
      icon = hasCRM ? '💼' : '⚠️';
      category = 'crm';
    } else if (log.operation === 'Cycle Completed' || log.message?.includes('Cycle') || log.message?.includes('Complete')) {
      friendlyMessage = `${agentName} completed outreach cycle`;
      icon = '🏁';
      category = 'cycle';
    } else if (log.operation === '💭 Agent Activity' || log.details?.thinking) {
      // Filter out repetitive thinking messages - only show if it's substantive
      const thinkingText = log.message || log.details?.thinking || `${agentName} is thinking`;
      // Skip generic "thinking" spam - only show if message has real content
      if (thinkingText.length < 20 || thinkingText === `${agentName} is thinking`) {
        return null; // Filter out noise
      }
      friendlyMessage = thinkingText;
      icon = '💭';
      category = 'thinking';
    } else {
      // Generic fallback
      friendlyMessage = log.message || log.details || log.operation;
      icon = '📝';
      category = 'general';
    }

    return {
      id: log.id || `${Date.now()}-${Math.random()}`,
      timestamp: log.timestamp || new Date().toISOString(),
      agentId: log.agentId,
      agentName,
      agentPersonality,
      message: friendlyMessage,
      icon,
      category,
      raw: log // Keep original for debugging
    };
  };

  // Fetch real world data
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(res => res.json())
      .then(data => {
        // Convert TopoJSON to GeoJSON
        const countries = feature(data, data.objects.countries);
        setWorldGeoData(countries);
        // Globe is ready
        setTimeout(() => setGlobeLoading(false), 100);
      })
      .catch(() => {
        // Fallback to simplified data if fetch fails
        setWorldGeoData(worldData);
        setTimeout(() => setGlobeLoading(false), 100);
      });
  }, []);



  useEffect(() => {
    if (!showGlobe || globeLoading) return; // Don't render during loading
    
    const canvas = canvasRef.current;
    if (!canvas || !worldGeoData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use state-based canvas size to prevent hydration issues
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const drawGlobe = () => {
      const currentRotation = rotationRef.current;
      
      // Adjust scale based on canvas size - larger globe
      const baseScale = canvasSize / 2.0; // Increased from 2.4 for larger globe
      const projection = geoOrthographic()
        .scale(baseScale)
        .translate([canvas.width / 2, canvas.height / 2])
        .rotate(currentRotation);

      const path = geoPath(projection, ctx as any);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Normal globe view
      // Draw ocean/globe background
      ctx.beginPath();
      path({ type: 'Sphere' } as any);
      ctx.fillStyle = 'rgba(100, 150, 255, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw graticule (lat/long lines)
      const graticule = geoGraticule();
      ctx.beginPath();
      path(graticule() as any);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Draw countries
      const features = worldGeoData.features || [];
      features.forEach((feature: any) => {
        ctx.beginPath();
        path(feature);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    };
    
    const animate = () => {
      drawGlobe();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [worldGeoData, canvasSize, showGlobe, globeLoading]);

// Auto-rotation effect - stops when agents are running
  useEffect(() => {
    if (isAnimatingToAgent) return;
    
    // Get all running agents
    const runningAgents = agents.filter(a => a.status === 'running' || agentActivities[a.agentId]?.isActive);
    
    // If agents are running, stop rotation
    if (runningAgents.length > 0) return;
    
    const interval = setInterval(() => {
      setRotation(prev => [prev[0] + 0.1, prev[1]]);  
    }, 50);
    
    return () => clearInterval(interval);
  }, [isAnimatingToAgent, agents, agentActivities]);

  // When agents start, spin to center on their locations
  useEffect(() => {
    const runningAgents = agents.filter(a => a.status === 'running' || agentActivities[a.agentId]?.isActive);
    
    // Only recalculate when agents start running (not every activity update)
    if (runningAgents.length === 0) return;
    
    // Collect all agent locations
    const agentLocations: Array<{lat: number, lng: number}> = [];
    
    runningAgents.forEach(agent => {
      const activity = agentActivities[agent.agentId];
      const location = activity?.location || agent.targeting?.location;
      
      if (location) {
        const coords = geocodeLocation(location);
        if (coords) {
          agentLocations.push(coords);
        }
      }
    });
    
    // Calculate center point (average of all locations)
    if (agentLocations.length > 0) {
      const avgLat = agentLocations.reduce((sum, loc) => sum + loc.lat, 0) / agentLocations.length;
      const avgLng = agentLocations.reduce((sum, loc) => sum + loc.lng, 0) / agentLocations.length;
      
      // Set target rotation to center on this location (keep same tilt/latitude)
      const targetLng = -avgLng;
      const targetLat = rotation[1]; // Keep current tilt
      
      console.log('🎯 Centering globe on agents:', {
        runningAgents: runningAgents.length,
        locations: agentLocations.length,
        avgLng,
        targetLng,
        currentRotation: rotation
      });
      
      // Only update if significantly different from current position
      const currentLng = rotation[0];
      
      if (Math.abs(targetLng - currentLng) > 10) {
        console.log('🔄 Starting rotation animation to:', [targetLng, targetLat]);
        setTargetRotation([targetLng, targetLat]);
        setIsAnimatingToAgent(true);
      }
    }
  }, [agents, agentActivities]);

  // Animate to target rotation when agent is clicked
  useEffect(() => {
    if (!targetRotation || !isAnimatingToAgent) return;
    
    const animate = () => {
      setRotation(prev => {
        const deltaLng = targetRotation[0] - prev[0];
        const deltaLat = targetRotation[1] - prev[1];
        
        // If close enough, snap to target and stop animating
        if (Math.abs(deltaLng) < 0.5 && Math.abs(deltaLat) < 0.5) {
          setIsAnimatingToAgent(false);
          setTargetRotation(null);
          return targetRotation;
        }
        
        // Move towards target
        return [
          prev[0] + deltaLng * 0.1,
          prev[1] + deltaLat * 0.1
        ];
      });
    };
    
    const interval = setInterval(animate, 16);
    return () => clearInterval(interval);
  }, [targetRotation, isAnimatingToAgent]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Country selection disabled
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!isMounted) {
    return (
      <AppLayout>
        <div suppressHydrationWarning className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-2xl font-semibold text-white">Loading...</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-3 lg:mr-[21.75%]">
        <h1 className="text-2xl font-bold text-white">Operations</h1>
      </div>

      {/* Top Tabs */}
      <div className="flex items-center gap-2 mb-4 pb-2">
        <button
          onClick={() => setActiveTab('director')}
          className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'director'
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF]'
              : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Agent Director
        </button>
        <button
          onClick={async () => {
            setActiveTab('queue');
            handleGlobeToggle(false);
            
            // Fetch queue emails when tab is clicked
            if (agents.length > 0) {
              setLoadingQueue(true);
              try {
                // Check if "all agents" is selected or a specific agent
                if (!selectedAgent) {
                  // Fetch all emails from all agents
                  const allEmails: any[] = [];
                  for (const agent of agents) {
                    if (agent.agentId === 'orphan') continue;
                    
                    try {
                      const response = await api.get(`/api/email-queue/queue`, {
                        params: { agentId: agent.agentId }
                      });
                      const emails = Array.isArray(response.data) ? response.data : (response.data.emails || []);
                      allEmails.push(...emails.map((email: any) => ({
                        ...email,
                        agentName: agent.name
                      })));
                    } catch (err: any) {
                      if (err?.response?.status !== 404) {
                        console.error('Error fetching emails for agent', agent.name, ':', err);
                      }
                    }
                  }
                  const sorted = allEmails.sort((a, b) => 
                    sortOrder === 'desc' 
                      ? new Date(b.queuedAt || b.timestamp).getTime() - new Date(a.queuedAt || a.timestamp).getTime()
                      : new Date(a.queuedAt || a.timestamp).getTime() - new Date(b.queuedAt || b.timestamp).getTime()
                  );
                  setQueueEmails(sorted);
                } else {
                  // Fetch specific agent's emails
                  fetchQueueEmails(selectedAgent.agentId, 'queued');
                }
              } catch (error) {
                console.error('Error fetching queue emails:', error);
              } finally {
                setLoadingQueue(false);
              }
            }
          }}
          className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'queue'
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF]'
              : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email Queue
        </button>
        <button
          onClick={() => {
            setActiveTab('globe');
            handleGlobeToggle(true);
          }}
          className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'globe'
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF]'
              : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Overview
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'analytics'
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF]'
              : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Analytics
        </button>
      </div>



      {/* Mobile Navigation/Stats - Only show on queue/globe tabs */}
      {(activeTab === 'queue' || activeTab === 'globe') && (
      <div className="sm:fixed relative px-2 pt-10 sm:pt-0 sm:top-6 sm:left-[47%] sm:-translate-x-1/2 sm:right-auto z-50 xl:hidden">
          <div className="flex flex-col gap-2">\n\n            {/* Start/Stop All Toggle Button - Mobile only */}
            <button
              onClick={async () => {
                const allRunning = agents.every(a => a.status === 'running');
                if (allRunning) {
                  // Optimistic update - immediately show as stopped
                  setAgents(prev => prev.map(a => ({ ...a, status: 'stopped' })));
                  setAgentActivities({});
                  
                  // Stop all
                  for (const agent of agents) {
                    try {
                      await api.post('/api/lead-agent/stop', { agentId: agent.agentId });
                    } catch (error) {
                      console.error('Error stopping agent:', error);
                    }
                  }
                } else {
                  // Optimistic update - immediately show as running
                  setAgents(prev => prev.map(a => a.agentId === 'orphan' ? a : { ...a, status: 'running' }));
                  
                  // Start all (exclude orphan agent)
                  for (const agent of agents) {
                    if (agent.agentId === 'orphan') continue; // Skip orphan placeholder
                    if (agent.status !== 'running') {
                      try {
                        await api.post('/api/lead-agent/start', { agentId: agent.agentId });
                      } catch (error) {
                        console.error('Error starting agent:', error);
                      }
                    }
                  }
                }
                await fetchAgents();
              }}
              className={`sm:hidden w-full px-4 py-3.5 rounded-lg backdrop-blur-md transition-all border-2 flex items-center justify-center gap-2 text-sm font-bold shadow-lg ${
                agents.filter(a => a.agentId !== 'orphan').every(a => a.status === 'running')
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40 hover:border-red-500/60'
                  : 'bg-[#4FD1FF]/20 hover:bg-[#4FD1FF]/30 text-[#4FD1FF] border-[#4FD1FF]/40 hover:border-[#4FD1FF]/60'
              }`}
            >
              {agents.filter(a => a.agentId !== 'orphan').every(a => a.status === 'running') ? 'Stop All Agents' : 'Start All Agents'}
            </button>
          </div>
        </div>
      )}{/* End Mobile Navigation */}

      {/* Info Dashboard - Right Side on desktop, after navigation on mobile */}
      <>
        <div className="hidden lg:block">
          <InfoDashboard agents={agents} agentActivities={agentActivities} showGlobe={showGlobe} setShowGlobe={handleGlobeToggle} />
        </div>
        <div className="lg:hidden">
          <InfoDashboard agents={agents} agentActivities={agentActivities} showGlobe={showGlobe} setShowGlobe={handleGlobeToggle} />
        </div>
      </>

      {/* Loading Overlay - only for navigation, not for queue modal */}
      {navigating && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] z-[9999] flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-2xl font-semibold text-white">Loading...</p>
          </div>
        </div>
      )}

      {/* Email Queue Section - Only show on queue tab */}
      {activeTab === 'queue' && (
      <div 
        className="hidden xl:flex fixed left-[265px] lg:right-[calc(20%+10px)] flex-col gap-6 z-30"
        style={{ top: 'calc(8% + 40px)' }}
      >
        {/* Email Activity Log */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Email Queue</h3>
            <div className="flex items-center gap-3">
              {/* Auto-Editor Button (only for queued) */}
              {selectedQueue?.type === 'queued' && !selectionMode && (
                <button
                  onClick={() => setShowAutoEditor(true)}
                  className="px-3 py-1 bg-blue-500/80 hover:bg-blue-600 text-white rounded text-xs border border-blue-400/50 transition-colors font-medium"
                  title="Find and replace text across all queued emails"
                >
                  🔧 Bulk Edit
                </button>
              )}
              
              {/* Selection Mode Controls */}
              {(selectedQueue?.type === 'queued' || !selectedQueue) && (
                <>
                  {!selectionMode ? (
                    <button
                      onClick={() => setSelectionMode(true)}
                      className="px-3 py-1 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 text-[#4FD1FF] rounded text-xs font-medium transition-colors border border-[#4FD1FF]/30"
                    >
                      Select
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectionMode(false);
                          setSelectedEmails(new Set());
                        }}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 text-[#8FA6C1] rounded text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      {selectedEmails.size > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-[#4FD1FF]/10 rounded border border-[#4FD1FF]/30">
                          <span className="text-[#4FD1FF] text-xs font-medium">{selectedEmails.size} selected</span>
                          <button
                            onClick={async () => {
                              if (!confirm(`Send ${selectedEmails.size} email(s)?`)) return;
                              
                              for (const emailId of selectedEmails) {
                                const email = queueEmails.find(e => (e._id || e.id) === emailId);
                                if (email) {
                                  await handleAcceptEmail(emailId, email.agentId);
                                }
                              }
                              
                              setSelectedEmails(new Set());
                              setSelectionMode(false);
                            }}
                            className="px-2 py-0.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs font-medium transition-colors"
                          >
                            Send All
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Reject ${selectedEmails.size} email(s)?`)) return;
                              
                              for (const emailId of selectedEmails) {
                                const email = queueEmails.find(e => (e._id || e.id) === emailId);
                                if (email) {
                                  await handleRejectEmailFromQueue(emailId, email.agentId);
                                }
                              }
                              
                              setSelectedEmails(new Set());
                              setSelectionMode(false);
                            }}
                            className="px-2 py-0.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded text-xs font-medium transition-colors"
                          >
                            Reject All
                          </button>
                          <button
                            onClick={() => setSelectedEmails(new Set())}
                            className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              
              <span className="text-[10px] text-[#8FA6C1] ml-2">
                {selectedQueue?.type === 'queued' ? totalQueuedEmails : queueEmails.length} emails
              </span>
              
              {/* Sort Order Toggle */}
              <button
                onClick={() => {
                  const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
                  setSortOrder(newOrder);
                  setQueueEmails(prev => [...prev].reverse());
                }}
                className="ml-2 px-2 py-1 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 text-[#4FD1FF] rounded text-[10px] font-medium transition-colors flex items-center gap-1 border border-[#4FD1FF]/30"
                title={sortOrder === 'desc' ? 'Latest first' : 'Earliest first'}
              >
                {sortOrder === 'desc' ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Latest
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Earliest
                  </>
                )}
              </button>
              
              {/* Font Size Controls */}
              <div className="flex items-center gap-1 ml-2 border border-[#4FD1FF]/30 rounded">
                <button
                  onClick={() => setFontSize(prev => Math.max(8, prev - 1))}
                  className="px-2 py-1 hover:bg-[#4FD1FF]/10 text-[#4FD1FF] text-xs font-bold transition-colors"
                  title="Decrease font size"
                >
                  A-
                </button>
                <span className="text-[#4FD1FF] text-[9px] px-1 border-x border-[#4FD1FF]/30">{fontSize}px</span>
                <button
                  onClick={() => setFontSize(prev => Math.min(18, prev + 1))}
                  className="px-2 py-1 hover:bg-[#4FD1FF]/10 text-[#4FD1FF] text-xs font-bold transition-colors"
                  title="Increase font size"
                >
                  A+
                </button>
              </div>
            </div>
          </div>
          
          {/* Agent Filter */}
          <div className="mb-2 mt-3">
            <div className="relative">
              <select
                value={selectedAgent?.agentId || 'all'}
                onChange={(e) => {
                  const agentId = e.target.value;
                  if (agentId === 'all') {
                    setSelectedAgent(null);
                    // Fetch all emails from all agents
                    const fetchAllEmails = async () => {
                      try {
                        const allEmails: any[] = [];
                        for (const agent of agents) {
                          if (agent.agentId === 'orphan') continue;
                          const response = await api.get(`/api/email-queue/${selectedQueue?.type === 'sent' ? 'sent' : selectedQueue?.type === 'replied' ? 'replied' : 'queue'}`, {
                            params: { agentId: agent.agentId }
                          });
                          const emails = Array.isArray(response.data) ? response.data : (response.data.emails || []);
                          allEmails.push(...emails.map((email: any) => ({
                            ...email,
                            agentName: agent.name
                          })));
                        }
                        setQueueEmails(allEmails.sort((a, b) => 
                          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
                        ));
                      } catch (error) {
                        console.error('Error fetching all emails:', error);
                      }
                    };
                    fetchAllEmails();
                  } else {
                    const agent = agents.find(a => a.agentId === agentId);
                    if (agent) {
                      setSelectedAgent(agent);
                      fetchQueueEmails(agentId, selectedQueue?.type || 'queued');
                    }
                  }
                }}
                className="w-full px-2 py-1 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-[11px] focus:outline-none focus:border-[#4FD1FF]/40 transition-colors"
              >
                <option value="all">All Agents</option>
                {agents.map(agent => (
                  <option key={agent.agentId} value={agent.agentId}>{agent.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-1.5 h-[700px] overflow-y-auto bg-[#0A1525]/40 rounded p-2">
            {queueEmails.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 bg-[#4FD1FF]/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-[#8FA6C1] text-sm">No emails in {selectedQueue?.type} queue</p>
                <p className="text-[#8FA6C1]/60 text-xs mt-2">{selectedAgent?.name || 'All agents'}</p>
              </div>
            ) : (
              <>
                {(() => {
                  const EMAILS_PER_PAGE = 20;
                  const type = selectedQueue?.type || 'queued';
                  // For backend pagination (queued emails), we already have the right page
                  // For client-side pagination (sent/replied), use slice
                  const totalPages = type === 'queued' 
                    ? Math.ceil(totalQueuedEmails / EMAILS_PER_PAGE)
                    : Math.ceil(queueEmails.length / EMAILS_PER_PAGE);
                  
                  const paginatedEmails = type === 'queued'
                    ? queueEmails // Already paginated by backend
                    : queueEmails.slice((currentEmailPage - 1) * EMAILS_PER_PAGE, currentEmailPage * EMAILS_PER_PAGE);
                  
                  return (
                    <>
                      {/* Select Page Button - only show in selection mode and queued type */}
                      {selectionMode && (selectedQueue?.type === 'queued' || !selectedQueue) && (
                        <div className="flex items-center justify-between mb-2 px-1">
                          <button
                            onClick={() => {
                              const currentPageIds = new Set(paginatedEmails.map(e => e._id || e.id).filter(Boolean));
                              if (paginatedEmails.every(e => selectedEmails.has(e._id || e.id))) {
                                // Deselect all on page
                                setSelectedEmails(prev => {
                                  const newSet = new Set(prev);
                                  currentPageIds.forEach(id => newSet.delete(id));
                                  return newSet;
                                });
                              } else {
                                // Select all on page
                                setSelectedEmails(prev => new Set([...prev, ...currentPageIds]));
                              }
                            }}
                            className="px-3 py-1 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 text-[#4FD1FF] rounded text-[10px] font-medium transition-colors border border-[#4FD1FF]/30"
                          >
                            {paginatedEmails.every(e => selectedEmails.has(e._id || e.id)) ? 'Deselect Page' : 'Select Page'}
                          </button>
                        </div>
                      )}
                      
                      {/* Pagination Controls - Top */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between p-3 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg mb-3">
                          <button
                            onClick={async () => {
                              const newPage = Math.max(1, currentEmailPage - 1);
                              setCurrentEmailPage(newPage);
                              await fetchEmailPage(newPage);
                            }}
                            disabled={currentEmailPage === 1 || loadingQueue}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors text-[#4FD1FF] text-[11px] font-medium"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {loadingQueue ? 'Loading...' : 'Previous'}
                          </button>
                          
                          <span className="text-[#8FA6C1] text-[11px]">
                            Page {currentEmailPage} of {totalPages} ({totalQueuedEmails} total)
                          </span>
                          
                          <button
                            onClick={async () => {
                              const newPage = Math.min(totalPages, currentEmailPage + 1);
                              setCurrentEmailPage(newPage);
                              await fetchEmailPage(newPage);
                            }}
                            disabled={currentEmailPage >= totalPages || loadingQueue}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors text-[#4FD1FF] text-[11px] font-medium"
                          >
                            {loadingQueue ? 'Loading...' : 'Next'}
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      )}
                      
                      {/* Loading State */}
                      {loadingQueue ? (
                        <div className="space-y-3">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="p-4 bg-[#0A1525]/40 border border-[#4FD1FF]/20 rounded-lg animate-pulse">
                              <div className="h-4 bg-[#4FD1FF]/10 rounded w-3/4 mb-3"></div>
                              <div className="h-3 bg-[#4FD1FF]/10 rounded w-1/2 mb-2"></div>
                              <div className="h-3 bg-[#4FD1FF]/10 rounded w-2/3"></div>
                            </div>
                          ))}
                        </div>
                      ) : paginatedEmails.length === 0 ? (
                        <div className="text-center text-[#8FA6C1]/60 py-8">
                          No emails in queue
                        </div>
                      ) : (
                        <>
                      {paginatedEmails.map((email, idx) => {
                  const emailId = email._id || email.id;
                  const isExpanded = expandedEmailId === emailId;
                  const hasAiReport = !!email.aiReport;
                  const isOrphaned = email.agentId === 'orphan';
                  const sentDate = (selectedQueue?.type === 'sent' && email.sentAt) ? new Date(email.sentAt) : null;
                  
                  // Debug: Log follow-up data for each email
                  if (selectedQueue?.type === 'sent' && idx === 0) {
                    console.log('📅 [FOLLOW-UP RENDER] First email in sent queue:', {
                      id: emailId,
                      followUpScheduled: email.followUpScheduled,
                      followUpDate: email.followUpDate,
                      hasFollowUpData: !!(email.followUpScheduled && email.followUpDate)
                    });
                  }
                  
                  return (
                    <div 
                      key={emailId || idx} 
                      className="bg-[#0A1525]/60 rounded border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 transition-all overflow-hidden"
                    >
                      {/* Collapsed Header */}
                      <div
                        className="p-2.5 cursor-pointer hover:bg-white/5"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                          setExpandedEmailId(isExpanded ? null : emailId);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            {/* Checkbox - only show in selection mode for queued emails */}
                            {selectionMode && (selectedQueue?.type === 'queued' || !selectedQueue) && (
                              <input
                                type="checkbox"
                                checked={selectedEmails.has(emailId)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmails(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(emailId)) {
                                      newSet.delete(emailId);
                                    } else {
                                      newSet.add(emailId);
                                    }
                                    return newSet;
                                  });
                                }}
                                className="w-4 h-4 rounded-full border-2 border-[#4FD1FF]/60 bg-[#0A1525]/60 text-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF] focus:ring-offset-0 flex-shrink-0 cursor-pointer mt-0.5"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {isOrphaned && (
                                <span className="text-[10px] font-semibold bg-red-500/80 text-white px-1.5 py-0.5 rounded">
                                  ORPHAN
                                </span>
                              )}
                              {selectedQueue?.type === 'sent' && email.deliveryStatus && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  email.deliveryStatus === 'delivered' ? 'bg-green-500/80 text-white' :
                                  email.deliveryStatus === 'bounced' ? 'bg-red-500/80 text-white' :
                                  'bg-yellow-500/80 text-white'
                                }`}>
                                  {email.deliveryStatus === 'delivered' ? '✓' :
                                   email.deliveryStatus === 'bounced' ? '✗' :
                                   '⏳'}
                                </span>
                              )}
                              <div className="text-white font-medium truncate flex-1" style={{ fontSize: `${fontSize}px` }}>
                                {email.subject || 'No Subject'}
                              </div>
                            </div>
                            </div>
                            <div className="text-[#8FA6C1] truncate mb-1" style={{ fontSize: `${fontSize}px` }}>
                              To: {email.to} {email.agentName && `• ${email.agentName}`}
                            </div>
                            <div className="flex items-center gap-2 text-[#8FA6C1]/70" style={{ fontSize: `${fontSize - 1}px` }}>
                              {email.queuedAt && (
                                <span>
                                  Queued: {new Date(email.queuedAt).toLocaleDateString()} {new Date(email.queuedAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                </span>
                              )}
                              {sentDate && (
                                <span>
                                  • Sent: {sentDate.toLocaleDateString()} {sentDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                </span>
                              )}
                            </div>
                            {/* Follow-up Status Indicator - only show for sent emails */}
                            {selectedQueue?.type === 'sent' && email.followUpScheduled && (
                              <div className="flex items-center gap-2 mt-1">
                                {/* Follow-up badge - use followUpStatus and rebumpCount to determine status */}
                                {(() => {
                                  const rebumpCount = email.rebumpCount || 0;
                                  const maxFollowUps = email.maxFollowUps || 1;
                                  // followUpStatus: 'QUEUED' = follow-up is in queue waiting for approval
                                  // followUpStatus: 'SENT' = follow-up was actually sent
                                  // For backward compat: if rebumpCount > 0 but no followUpStatus, treat as QUEUED
                                  const followUpStatus = email.followUpStatus || (rebumpCount > 0 ? 'QUEUED' : null);
                                  const followUpActuallySent = followUpStatus === 'SENT';
                                  const followUpQueued = followUpStatus === 'QUEUED';
                                  const allFollowUpsDone = followUpActuallySent && rebumpCount >= maxFollowUps;
                                  
                                  return (
                                    <>
                                      <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                        allFollowUpsDone
                                          ? 'bg-green-500/80 text-white' 
                                          : followUpActuallySent
                                            ? 'bg-purple-500/80 text-white'
                                            : followUpQueued
                                              ? 'bg-yellow-500/80 text-black'
                                              : email.followUpDate && new Date(email.followUpDate) <= new Date()
                                                ? 'bg-orange-500/80 text-white animate-pulse'
                                                : 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                                      }`}>
                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {allFollowUpsDone
                                          ? `✓ ${rebumpCount}/${maxFollowUps} follow-ups complete`
                                          : followUpActuallySent
                                            ? `Follow-up ${rebumpCount}/${maxFollowUps} sent`
                                            : followUpQueued
                                              ? `Follow-up ${rebumpCount}/${maxFollowUps} queued for review`
                                              : email.followUpDate && new Date(email.followUpDate) <= new Date()
                                                ? 'Follow-up due!'
                                                : `Follow-up scheduled (${rebumpCount}/${maxFollowUps})`
                                        }
                                      </span>
                                      {/* Next follow-up date - only show if not all done */}
                                      {email.followUpDate && !allFollowUpsDone && (
                                        <span className="text-[9px] text-[#8FA6C1]/60">
                                          {new Date(email.followUpDate) <= new Date() 
                                            ? followUpQueued ? 'Awaiting approval' : 'Due now'
                                            : `Next: ${new Date(email.followUpDate).toLocaleDateString()} ${new Date(email.followUpDate).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`
                                          }
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {hasAiReport && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingAiReport(email.aiReport);
                                }}
                                className="p-1 hover:bg-blue-500/20 rounded border border-blue-400/50 hover:border-blue-400 transition-colors"
                                title="View AI Research Report"
                              >
                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedEmailId(emailId);
                                setEditingEmail({
                                  id: emailId,
                                  subject: email.subject || '',
                                  body: email.body || '',
                                  to: email.to || '',
                                  cc: email.cc,
                                  bcc: email.bcc
                                });
                              }}
                              className="p-1 hover:bg-[#4FD1FF]/20 rounded border border-[#4FD1FF]/50 hover:border-[#4FD1FF] transition-colors"
                              title="Edit Email"
                            >
                              <svg className="w-3.5 h-3.5 text-[#4FD1FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <svg 
                              className={`w-3.5 h-3.5 text-[#4FD1FF] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-[#4FD1FF]/20 p-3 space-y-2.5 bg-[#0A1525]/60">
                          {editingEmail?.id === emailId ? (
                            /* Edit Mode */
                            <>
                              <div>
                                <div className="text-[10px] text-[#8FA6C1] mb-1">To</div>
                                <input
                                  type="text"
                                  value={editingEmail?.to || ''}
                                  onChange={(e) => editingEmail && setEditingEmail({...editingEmail, to: e.target.value})}
                                  className="w-full px-2 py-1.5 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-[11px] focus:outline-none focus:border-[#4FD1FF]/40"
                                />
                              </div>
                              
                              <div>
                                <div className="text-[10px] text-[#8FA6C1] mb-1">Subject</div>
                                <input
                                  type="text"
                                  value={editingEmail?.subject || ''}
                                  onChange={(e) => editingEmail && setEditingEmail({...editingEmail, subject: e.target.value})}
                                  className="w-full px-2 py-1.5 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-[11px] focus:outline-none focus:border-[#4FD1FF]/40"
                                />
                              </div>

                              <div>
                                <div className="text-[10px] text-[#8FA6C1] mb-1">Email Body</div>
                                <textarea
                                  value={editingEmail?.body || ''}
                                  onChange={(e) => editingEmail && setEditingEmail({...editingEmail, body: e.target.value})}
                                  rows={8}
                                  className="w-full px-2 py-1.5 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-[11px] whitespace-pre-wrap font-mono resize-none focus:outline-none focus:border-[#4FD1FF]/40"
                                />
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEmail(null);
                                  }}
                                  className="px-3 py-1.5 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/40 text-gray-400 text-[11px] font-medium rounded transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!editingEmail) return;
                                    
                                    // Optimistic update - update local state immediately
                                    setQueueEmails(prev => prev.map(em => 
                                      (em._id || em.id) === emailId 
                                        ? { ...em, subject: editingEmail.subject, body: editingEmail.body, to: editingEmail.to, cc: editingEmail.cc, bcc: editingEmail.bcc }
                                        : em
                                    ));
                                    setEditingEmail(null);
                                    
                                    try {
                                      // Use the email's actual agentId instead of selectedAgent
                                      const emailAgentId = email.agentId || selectedAgent?.agentId || 'all';
                                      await api.put(`/api/email-queue/${emailId}?agentId=${emailAgentId}`, {
                                        subject: editingEmail.subject,
                                        body: editingEmail.body,
                                        to: editingEmail.to,
                                        cc: editingEmail.cc,
                                        bcc: editingEmail.bcc
                                      });
                                      showToast('Email updated successfully', 'success');
                                    } catch (error) {
                                      console.error('Error updating email:', error);
                                      showToast('Failed to update email', 'error');
                                      // Revert on error
                                      if (selectedAgent) {
                                        fetchQueueEmails(selectedAgent.agentId, selectedQueue?.type || 'queued');
                                      } else {
                                        // Reload all emails for all agents
                                        try {
                                          const allEmails: any[] = [];
                                          for (const agent of agents) {
                                            if (agent.agentId === 'orphan') continue;
                                            const response = await api.get(`/api/email-queue/${selectedQueue?.type === 'sent' ? 'sent' : selectedQueue?.type === 'replied' ? 'replied' : 'queue'}`, {
                                              params: { agentId: agent.agentId }
                                            });
                                            const emails = Array.isArray(response.data) ? response.data : (response.data.emails || []);
                                            allEmails.push(...emails.map((email: any) => ({
                                              ...email,
                                              agentName: agent.name
                                            })));
                                          }
                                          setQueueEmails(allEmails);
                                        } catch (err) {
                                          console.error('Error reloading emails:', err);
                                        }
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 text-[11px] font-medium rounded transition-colors"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </>
                          ) : (
                            /* View Mode */
                            <>
                              <div>
                                <div className="text-[#8FA6C1] mb-1" style={{ fontSize: `${fontSize - 1}px` }}>Subject</div>
                                <div className="text-white" style={{ fontSize: `${fontSize}px` }}>{email.subject || 'No subject'}</div>
                              </div>

                              <div>
                                <div className="text-[#8FA6C1] mb-1" style={{ fontSize: `${fontSize - 1}px` }}>Email Body</div>
                                <div className="bg-[#0A1525]/80 rounded p-2.5 text-white/90 whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto" style={{ fontSize: `${fontSize}px` }}>
                                  {email.body || 'No content'}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptEmail(emailId, email.agentId);
                                  }}
                                  className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-400 text-[11px] font-medium rounded transition-colors"
                                >
                                  ✓ Accept
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectEmailFromQueue(emailId, email.agentId);
                                  }}
                                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-[11px] font-medium rounded transition-colors"
                                >
                                  ✗ Reject
                                </button>
                                {email.agentName && (
                                  <span className="text-[10px] text-[#8FA6C1] ml-auto">
                                    {email.agentName}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                        </>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>
      )}{/* End Email Queue Section */}

      {/* Tab Content */}
      {activeTab === 'director' && (
        <>
          <div 
            className="fixed left-[265px] lg:right-[calc(20%+10px)] top-[calc(8%+40px)] bottom-0 flex flex-col z-30 bg-[#0F1E35]/95 backdrop-blur-xl border-l border-r border-white/10"
          >
          {/* Top Divider */}
          <div className="border-t border-white/20"></div>
          
          {/* Today's Wins */}
          <div className="p-3 border-b border-[#4FD1FF]/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-medium text-xs uppercase tracking-wider">Today's Wins</h3>
              <span className="text-[#8FA6C1] text-[9px]">
                Resets at midnight
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {/* Emails Sent */}
              <div className="bg-[#0A1525]/40 p-2 border border-[#4FD1FF]/10 transition-all duration-300 hover:border-[#4FD1FF]/30">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                  <span className="text-[#8FA6C1] text-[9px] uppercase tracking-wide">Sent</span>
                </div>
                <div className="text-white text-xl font-bold transition-all duration-300">{stats.totalEmailsSent}</div>
                <div className="text-[#8FA6C1]/60 text-[8px] mt-0.5">Emails</div>
              </div>
              
              {/* Emails Queued */}
              <div className="bg-[#0A1525]/40 p-2 border border-[#4FD1FF]/10 transition-all duration-300 hover:border-[#4FD1FF]/30">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></div>
                  <span className="text-[#8FA6C1] text-[9px] uppercase tracking-wide">Queue</span>
                </div>
                <div className="text-white text-xl font-bold transition-all duration-300">{stats.totalEmailsQueued}</div>
                <div className="text-[#8FA6C1]/60 text-[8px] mt-0.5">Pending</div>
              </div>
              
              {/* Cycles Completed */}
              <div className="bg-[#0A1525]/40 p-2 border border-[#4FD1FF]/10 transition-all duration-300 hover:border-[#4FD1FF]/30">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4FD1FF] animate-pulse"></div>
                  <span className="text-[#8FA6C1] text-[9px] uppercase tracking-wide">Cycles</span>
                </div>
                <div className="text-white text-xl font-bold transition-all duration-300">
                  {cycleEvents.filter(e => e.type === 'cycle_complete').length}
                </div>
                <div className="text-[#8FA6C1]/60 text-[8px] mt-0.5">Complete</div>
              </div>
              
              {/* Queued Emails Button */}
              <button
                onClick={() => {
                  if (stats.totalEmailsQueued > 0) {
                    setActiveTab('queue');
                    handleGlobeToggle(false);
                  }
                }}
                disabled={stats.totalEmailsQueued === 0}
                className={`bg-[#0A1525]/40 p-2 border transition-all duration-300 flex items-center justify-center ${
                  stats.totalEmailsQueued > 0
                    ? 'border-[#4FD1FF]/30 hover:border-[#4FD1FF]/60 hover:bg-[#4FD1FF]/10 cursor-pointer'
                    : 'border-[#4FD1FF]/10 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    stats.totalEmailsQueued > 0 ? 'bg-orange-400 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  <span className={`text-[10px] uppercase tracking-wide font-semibold ${
                    stats.totalEmailsQueued > 0 ? 'text-[#4FD1FF]' : 'text-[#8FA6C1]'
                  }`}>View Email Queue</span>
                </div>
              </button>
            </div>
          </div>

          {/* AI Summary Box */}
          <div className="p-3 border-b border-[#4FD1FF]/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></div>
              <h3 className="text-white font-medium text-xs uppercase tracking-wider">Agent Activity Summary</h3>
            </div>
            <div className="bg-[#0A1525]/40 p-3 border border-[#4FD1FF]/10">
              <p className="text-[#8FA6C1] text-[11px] leading-relaxed">{aiSummary}</p>
            </div>
          </div>

          {/* Activity Log & Control Center */}
          <div className="flex flex-col flex-1 min-h-0 relative">
            {/* Activity Log Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#4FD1FF]/10">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                <h3 className="text-white font-medium text-xs uppercase tracking-wider">Agent Activity Log</h3>
              </div>
              {agents.filter(a => a.agentId !== 'orphan' && a.status === 'running').length > 0 && (
                <button
                  onClick={async () => {
                    // Optimistic update
                    setAgents(prev => prev.map(a => ({ ...a, status: 'stopped' })));
                    setAgentActivities({});
                    
                    // Stop all agents
                    for (const agent of agents) {
                      if (agent.agentId === 'orphan') continue;
                      try {
                        await api.post('/api/lead-agent/stop', { agentId: agent.agentId });
                      } catch (error) {
                        console.error('Error stopping agent:', error);
                      }
                    }
                    await fetchAgents();
                  }}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 hover:border-red-500/60 text-red-300 rounded transition-all flex items-center gap-2 text-xs font-semibold"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop All
                </button>
              )}
            </div>
            
            {/* Activity Log Content */}
            <div className="flex-1 overflow-hidden relative flex">
              {/* Agent Filter Sidebar */}
              <div className="w-32 border-r border-[#4FD1FF]/10 flex flex-col py-2">
                <button
                  onClick={() => setSelectedAgentFilter('all')}
                  className={`px-3 py-2 text-xs font-medium transition-all text-left flex items-center gap-2 ${
                    selectedAgentFilter === 'all'
                      ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-r-2 border-[#4FD1FF]'
                      : 'text-[#8FA6C1] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                  </svg>
                  All Agents
                </button>
                <div className="h-px bg-[#4FD1FF]/10 my-2"></div>
                {agents.filter(a => a.agentId !== 'orphan').map(agent => (
                  <div
                    key={agent.agentId}
                    className={`flex items-center transition-all ${
                      selectedAgentFilter === agent.agentId
                        ? 'bg-[#4FD1FF]/20 border-r-2 border-[#4FD1FF]'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedAgentFilter(agent.agentId)}
                      className="flex-1 min-w-0 px-3 py-2 text-xs font-medium text-left flex items-center gap-2 text-[#8FA6C1] hover:text-white"
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border border-[#4FD1FF]/20">
                        <img 
                          src={`/avatars/${(() => {
                            const typeMap: Record<string, string> = {
                              'hunter': 'Hunter',
                              'analyst': 'Analyst',
                              'consultant': 'consultant',
                              'networker': 'Networker',
                              'relationship-builder': 'Relationship-Builder'
                            };
                            return typeMap[agent.personality?.type || 'hunter'] || 'Hunter';
                          })()}.png`}
                          alt={agent.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
                      <span className="truncate">{agent.name}</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (agent.status === 'running') {
                          // Stop agent
                          setAgents(prev => prev.map(a => a.agentId === agent.agentId ? { ...a, status: 'stopped' } : a));
                          try {
                            await api.post('/api/lead-agent/stop', { agentId: agent.agentId });
                            await fetchAgents();
                          } catch (error) {
                            console.error('Error stopping agent:', error);
                          }
                        } else {
                          // Start agent
                          setAgents(prev => prev.map(a => a.agentId === agent.agentId ? { ...a, status: 'running' } : a));
                          try {
                            await api.post('/api/lead-agent/start', { agentId: agent.agentId });
                            await fetchAgents();
                          } catch (error) {
                            console.error('Error starting agent:', error);
                          }
                        }
                      }}
                      className="flex-shrink-0 px-2 py-2 hover:bg-white/10 transition-colors"
                    >
                      {agent.status === 'running' ? (
                        <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* Activity Logs List */}
              <div className="flex-1 overflow-y-auto">
                {agents.filter(a => a.agentId !== 'orphan' && a.status === 'running').length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <button
                      onClick={async () => {
                        setAgents(prev => prev.map(a => a.agentId === 'orphan' ? a : { ...a, status: 'running' }));
                        for (const agent of agents) {
                          if (agent.agentId === 'orphan') continue;
                          if (agent.status !== 'running') {
                            try {
                              await api.post('/api/lead-agent/start', { agentId: agent.agentId });
                            } catch (error) {
                              console.error('Error starting agent:', error);
                            }
                          }
                        }
                        await fetchAgents();
                      }}
                      className="px-16 py-8 bg-green-500/20 hover:bg-green-500/30 border-2 border-green-500/40 hover:border-green-500/60 text-green-300 rounded-lg transition-all duration-300 flex items-center gap-5 text-2xl font-bold shadow-lg"
                    >
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start All Agents
                    </button>
                    <div className="mt-8 space-y-2">
                      <p className="text-[#8FA6C1] text-sm font-medium">No Active Agents</p>
                      <p className="text-[#8FA6C1]/60 text-xs">Activity logs will appear here when agents are running</p>
                    </div>
                  </div>
                ) : activityLogs.filter(log => selectedAgentFilter === 'all' || log.agentId === selectedAgentFilter).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="w-16 h-16 bg-[#4FD1FF]/10 border-2 border-[#4FD1FF]/30 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-[#4FD1FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-[#8FA6C1] text-sm font-medium">Waiting for Activity...</p>
                    <p className="text-[#8FA6C1]/60 text-xs mt-1">{agents.filter(a => a.agentId !== 'orphan' && a.status === 'running').length} agent{agents.filter(a => a.agentId !== 'orphan' && a.status === 'running').length !== 1 ? 's' : ''} running</p>
                  </div>
                ) : (
                  <div className="space-y-1 p-3">
                    {activityLogs
                      .filter(log => selectedAgentFilter === 'all' || log.agentId === selectedAgentFilter)
                      .map((log, idx) => (
                        <div 
                          key={log.id || idx}
                          className="flex items-start gap-3 p-3 bg-[#0A1525]/40 rounded border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/20"
                        >
                          {/* Agent Avatar */}
                          <div className="w-8 h-8 rounded-full border-2 border-[#4FD1FF]/30 flex-shrink-0 overflow-hidden bg-[#0A1525]/60">
                            <img 
                              src={`/avatars/${(() => {
                                const typeMap: Record<string, string> = {
                                  'hunter': 'Hunter',
                                  'analyst': 'Analyst',
                                  'consultant': 'consultant',
                                  'networker': 'Networker',
                                  'relationship-builder': 'Relationship-Builder'
                                };
                                return typeMap[log.agentPersonality || 'hunter'] || 'Hunter';
                              })()}.png`}
                              alt={log.agentName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>

                          {/* Log Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[#4FD1FF] text-xs font-semibold">{log.agentName}</span>
                              <span className="text-[#8FA6C1]/50 text-[10px]">
                                {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})}
                              </span>
                            </div>
                            <p className="text-[#8FA6C1] text-xs leading-relaxed">{log.message}</p>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Bottom border aligned with Quick Actions */}
          <div className="border-t border-white/10"></div>
        </div>
        </>
      )}

      {activeTab === 'queue' && (
        <div className="pt-32">
          {loadingQueue ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-[#4FD1FF]/20 border-t-[#4FD1FF] rounded-full animate-spin"></div>
                <p className="text-[#8FA6C1] text-sm">Loading email queue...</p>
              </div>
            </div>
          ) : (
            <div>{/* Email Queue tab content */}</div>
          )}
        </div>
      )}

      {activeTab === 'globe' && (
      <div className="fixed inset-0 lg:right-[20.75%] pointer-events-none">

      {isMounted && (
        <div 
          className={`hidden sm:flex fixed left-[265px] lg:right-[calc(20%+10px)] top-[200px] justify-center transition-all duration-700 ease-out pointer-events-auto ${
            showGlobe || isAnimatingOut ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
        {/* Globe - Hidden on mobile */}
        <div className="text-center relative">
          {/* Globe Canvas */}
          {(showGlobe || isAnimatingOut) && (
            <canvas
              ref={canvasRef}
              className={`cursor-default transition-all duration-500 ${!showGlobe && isAnimatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
              onClick={handleCanvasClick}
            />
          )}
        </div>
      </div>
      )}

      {/* Email Dots on Globe (color-coded by status) */}
      {showGlobe && !globeLoading && emailDots.map((email) => {
        // Project email location to screen coordinates
        const baseScale = canvasSize / 2.0;
        const centerPos = canvasSize / 2;
        const projection = geoOrthographic()
          .scale(baseScale)
          .rotate(rotation)
          .translate([centerPos, centerPos]);
        
        const coords = projection([email.location.lng, email.location.lat]);
        if (!coords) return null;
        
        // Calculate screen position (same as agent positioning)
        const canvasCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
        const canvasCenterY = typeof window !== 'undefined' ? window.innerHeight : 0;
        const pointX = canvasCenterX + (coords[0] - centerPos);
        const pointY = canvasCenterY + (coords[1] - centerPos);
        
        // Color based on status: green = meeting, white = sent, yellow/orange = queued
        const dotColor = email.status === 'meeting' ? '#4ade80' : 
                        email.status === 'sent' ? '#ffffff' : 
                        '#fbbf24'; // yellow/orange for queued
        
        return (
          <div key={email.id} className="fixed pointer-events-none" style={{ zIndex: 44 }}>
            <svg className="fixed inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
              <circle
                cx={pointX}
                cy={pointY}
                r="3"
                fill={dotColor}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1"
                opacity="0.8"
                className="animate-pulse"
              />
            </svg>
          </div>
        );
      })}

      {/* Active Agents on Globe */}
      {showGlobe && !globeLoading && agents.filter(a => a.agentId !== 'orphan').map((agent, index) => {
        // Show agents that are running OR have activity
        const activity = agentActivities[agent.agentId];
        const isActive = agent.status === 'running' || activity?.isActive;
        if (!isActive) return null;
        
        // Get real location from SSE activity data, or fall back to random US position
        let lat, lng;
        if (activity?.location) {
          const coords = geocodeLocation(activity.location);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          } else {
            // Fallback to random US position
            const seed = index * 137.508;
            lat = 25 + ((Math.abs(Math.sin(seed)) * 24));
            lng = -125 + ((Math.abs(Math.cos(seed)) * 60));
          }
        } else {
          // Fallback to random US position
          const seed = index * 137.508;
          lat = 25 + ((Math.abs(Math.sin(seed)) * 24));
          lng = -125 + ((Math.abs(Math.cos(seed)) * 60));
        }
        
        // Project to screen coordinates using same projection as canvas
        const baseScale = canvasSize / 2.0;
        const centerPos = canvasSize / 2;
        const projection = geoOrthographic()
          .scale(baseScale)
          .rotate(rotation)
          .translate([centerPos, centerPos]);
        
        const coords = projection([lng, lat]);
        if (!coords) return null;
        
        // Canvas position: bottom-[-40%] means bottom edge is at 140% viewport height
        // Canvas center Y = 1.4 * viewport height - half canvas size
        const canvasCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
        const canvasCenterY = typeof window !== 'undefined' ? (1.4 * window.innerHeight) - (canvasSize / 2) : 0;
        
        // Point position relative to canvas center
        const pointX = canvasCenterX + (coords[0] - centerPos);
        const pointY = canvasCenterY + (coords[1] - centerPos);
        
        // Callout line extends out from the point
        const calloutAngle = (index * 60) % 360; // Different angles for each agent
        const lineLength = 60;
        const horizontalLength = 80;
        const slantEndX = pointX + Math.cos(calloutAngle * Math.PI / 180) * lineLength;
        const slantEndY = pointY + Math.sin(calloutAngle * Math.PI / 180) * lineLength;
        const horizontalEndX = slantEndX + horizontalLength;
        const horizontalEndY = slantEndY;
        
        // Get current keywords from activity or agent settings
        const industries = agent.settings?.companyCriteria?.companyIndustries || [];
        const positions = agent.settings?.contactCriteria?.targetPositions || [];
        const keywordText = industries.length > 0 
          ? industries.slice(0, 2).join(', ') 
          : positions.length > 0 
          ? positions.slice(0, 2).join(', ')
          : 'searching...';
        
        return (
          <div 
            key={agent.agentId} 
            className="fixed pointer-events-none animate-fade-in" 
            style={{ 
              zIndex: 45,
              animation: 'fadeIn 0.5s ease-out'
            }}
          >
            {/* Callout line */}
            <svg className="fixed inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
              {/* Slant line from point to callout */}
              <line
                x1={pointX}
                y1={pointY}
                x2={slantEndX}
                y2={slantEndY}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                className="animate-draw-line"
              />
              {/* Horizontal line */}
              <line
                x1={slantEndX}
                y1={slantEndY}
                x2={horizontalEndX}
                y2={horizontalEndY}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                className="animate-draw-line"
                style={{ animationDelay: '0.2s' }}
              />
              {/* Point marker on globe */}
              <circle
                cx={pointX}
                cy={pointY}
                r="4"
                fill="rgb(74, 222, 128)"
                stroke="white"
                strokeWidth="2"
                className="animate-scale-in"
              />
            </svg>
            
            {/* Agent info at end of horizontal line */}
            <div
              className="fixed pointer-events-auto transition-all duration-300"
              style={{
                left: `${horizontalEndX}px`,
                top: `${horizontalEndY}px`,
                transform: 'translateY(-50%)'
              }}
            >
              {/* Agent name and search keywords above */}
              <div className="text-white/90 text-xs font-medium mb-1 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">{agent.name}</span>
                </div>
                <div className="text-white/70 text-[10px]">{keywordText}</div>
              </div>
              
              {/* Avatar and Stop button */}
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    onClick={() => {
                      setLoadingQueue(true);
                      router.push(`/agents?agent=${agent.agentId}&returnTo=/dashboard`);
                    }}
                    className="block transition-all duration-150 active:scale-90"
                  >
                    <img 
                      src={agent.avatar || agent.personality?.avatar} 
                      alt={agent.name}
                      className="w-10 h-10 rounded-full border-2 border-green-400 shadow-lg transition-all duration-150 hover:scale-110 hover:shadow-green-400/50 active:scale-95 active:shadow-green-400/80 cursor-pointer object-cover"
                    />
                  </button>
                  
                  {/* Tooltip on hover */}
                  <div className="absolute left-12 top-0 bg-black/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 min-w-[200px]">
                    <div className="font-bold mb-1">
                      {activity?.location?.companyName || 'Targeting:'}
                    </div>
                    <div className="text-white/80 text-[10px] space-y-0.5">
                      {activity?.location && (
                        <>
                          {activity.location.city && <div>📍 {activity.location.city}, {activity.location.state || activity.location.country}</div>}
                          {activity.targeting?.industry && <div>🏢 {activity.targeting.industry}</div>}
                          {activity.targeting?.position && <div>👤 {activity.targeting.position}</div>}
                        </>
                      )}
                      {!activity?.location && (
                        <>
                          {agent.settings?.companyCriteria?.companyIndustries && agent.settings.companyCriteria.companyIndustries.length > 0 && (
                            <div>Industries: {agent.settings.companyCriteria.companyIndustries.slice(0, 3).join(', ')}</div>
                          )}
                          {agent.settings?.contactCriteria?.targetPositions && agent.settings.contactCriteria.targetPositions.length > 0 && (
                            <div>Positions: {agent.settings.contactCriteria.targetPositions.slice(0, 3).join(', ')}</div>
                          )}
                          {agent.settings?.companyCriteria?.companySizeMin && agent.settings?.companyCriteria?.companySizeMax && (
                            <div>Size: {agent.settings.companyCriteria.companySizeMin}-{agent.settings.companyCriteria.companySizeMax} emp</div>
                          )}
                        </>
                      )}
                      {(!activity?.location && (!agent.settings?.companyCriteria?.companyIndustries || agent.settings.companyCriteria.companyIndustries.length === 0) && 
                       (!agent.settings?.contactCriteria?.targetPositions || agent.settings.contactCriteria.targetPositions.length === 0)) && (
                        <div>General lead search</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={async () => {
                    // Optimistic update - hide agent immediately
                    setAgentActivities(prev => ({
                      ...prev,
                      [agent.agentId]: { ...prev[agent.agentId], isActive: false }
                    }));
                    setAgents(prev => prev.map(a => 
                      a.agentId === agent.agentId 
                        ? { ...a, status: 'idle' }
                        : a
                    ));
                    
                    try {
                      await api.post('/api/lead-agent/stop', { agentId: agent.agentId });
                    } catch (error) {
                      console.error('Error stopping agent:', error);
                      // Revert on error
                      fetchAgents();
                    }
                  }}
                  className="px-2 py-1 bg-red-500/80 hover:bg-red-500 active:bg-red-600 active:scale-95 text-white text-xs rounded transition-all"
                >
                  Stop
                </button>
              </div>
              
              {/* Activity info below */}
              <div className="text-white/70 text-xs mt-1 whitespace-nowrap max-w-[200px] truncate">
                {activity?.status || agent.currentActivity || 'Running...'}
              </div>
            </div>
          </div>
        );
      })}

      </div>
      )}{/* End Globe Tab */}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div 
          className="fixed left-[265px] lg:right-[calc(20%+10px)] top-[calc(8%+40px)] bottom-0 flex flex-col z-30 bg-[#0F1E35]/95 backdrop-blur-xl border-l border-r border-white/10 overflow-y-auto pb-4"
        >
          <div className="space-y-6 p-6">
          {/* Top Stats - Replies Received and Reply Rate as thin boxes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
            {/* Replied Card - Thin */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 hover:bg-white/15 transition-all duration-300 flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm font-medium">Replies Received</p>
                <p className="text-white text-3xl font-bold">{stats.emailsViewed}</p>
              </div>
              <div className="h-12 w-24 flex items-end gap-0.5">
                {agents.slice(0, 11).map((agent, i) => {
                  const maxReplied = Math.max(...agents.map(a => a.replied || 0), 1);
                  const height = ((agent.replied || 0) / maxReplied) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-green-400 to-green-300 rounded-t hover:opacity-80 transition-opacity"
                      style={{ height: `${height}%` }}
                      title={`${agent.name}: ${agent.replied}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Reply Rate Card - Thin */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 hover:bg-white/15 transition-all duration-300 flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm font-medium">Reply Rate</p>
                <p className="text-white text-3xl font-bold">{stats.emailsSent > 0 ? ((stats.emailsViewed / stats.emailsSent) * 100).toFixed(1) : '0'}%</p>
              </div>
              <div className="h-12 w-24 flex items-end gap-0.5">
                {agents.slice(0, 11).map((agent, i) => {
                  const rate = (agent.sent || 0) > 0 ? ((agent.replied || 0) / (agent.sent || 1)) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-blue-400 to-blue-300 rounded-t hover:opacity-80 transition-opacity"
                      style={{ height: `${rate}%` }}
                      title={`${agent.name}: ${rate.toFixed(1)}%`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Queued and Sent - Large detailed graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
            {/* Queued Emails - Large Detailed */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white">Queued Emails</h2>
                <span className="text-white text-2xl font-bold">{stats.emailsQueued}</span>
              </div>
              <div className="h-40 relative flex">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between text-[10px] text-white/50 pr-1" style={{ width: '30px' }}>
                  {(() => {
                    // Calculate max from both current AND historical values
                    let maxQueued = Math.max(...agents.map(a => a.queued || 0), 1);
                    agents.forEach(a => {
                      const hist = agentMetricsHistory[a.agentId] || [];
                      hist.forEach((h: any) => { if ((h.queued || 0) > maxQueued) maxQueued = h.queued; });
                    });
                    let scale;
                    if (maxQueued >= 1000) scale = 400;
                    else if (maxQueued >= 400) scale = 200;
                    else if (maxQueued >= 100) scale = 40;
                    else if (maxQueued >= 40) scale = 20;
                    else scale = 4;
                    const maxRounded = Math.ceil(maxQueued / scale) * scale;
                    const step = maxRounded / 4;
                    return [maxRounded, maxRounded - step, maxRounded - step*2, maxRounded - step*3, 0].map((val, i) => (
                      <span key={i} className="text-right">{val >= 1000 ? `${Math.floor(val/1000)}k` : Math.floor(val)}</span>
                    ));
                  })()}
                </div>
                <svg className="flex-1 h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Axes */}
                  <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  <line x1="0" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  
                  {/* Grid lines */}
                  <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  
                  {(() => {
                    const agentColors = [
                      '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                      '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1', '#94a3b8'
                    ];
                    
                    if (agents.length === 0) return null;
                    
                    // Calculate max from both current AND historical values
                    let maxQueued = Math.max(...agents.map(a => a.queued || 0), 1);
                    agents.forEach(a => {
                      const hist = agentMetricsHistory[a.agentId] || [];
                      hist.forEach((h: any) => { if ((h.queued || 0) > maxQueued) maxQueued = h.queued; });
                    });
                    let scale;
                    if (maxQueued >= 1000) scale = 400;
                    else if (maxQueued >= 400) scale = 200;
                    else if (maxQueued >= 100) scale = 40;
                    else if (maxQueued >= 40) scale = 20;
                    else scale = 4;
                    const maxRounded = Math.ceil(maxQueued / scale) * scale;
                    
                    return (
                      <>
                        {agents.map((agent, agentIdx) => {
                          const color = agent.agentId === 'orphan' ? '#94a3b8' : agentColors[agentIdx % agentColors.length];
                          const queuedValue = agent.queued || 0;
                          const history = agentMetricsHistory[agent.agentId] || [];
                          
                          // Generate points from real historical data or show current value only
                          let points;
                          if (history.length >= 2) {
                            // Use real historical data, but ensure last point matches current value
                            const stepX = 100 / history.length;
                            points = history.map((snapshot, i) => {
                              const x = i * stepX;
                              const value = snapshot.queued || 0;
                              const y = 100 - (value / maxRounded) * 100;
                              return `${x},${Math.max(0, Math.min(100, y))}`;
                            });
                            // Add current value as final point at x=100
                            const currentY = 100 - (queuedValue / maxRounded) * 100;
                            points.push(`100,${Math.max(0, Math.min(100, currentY))}`);
                            points = points.join(' ');
                          } else {
                            // No history yet - show flat line at current value
                            const y = 100 - (queuedValue / maxRounded) * 100;
                            points = `0,${y} 100,${y}`;
                          }
                          
                          return (
                            <g key={agentIdx}>
                              <polyline
                                points={points}
                                fill="none"
                                stroke={color}
                                strokeWidth="0.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.9"
                              />
                              <circle
                                cx={100}
                                cy={100 - (queuedValue / maxRounded) * 100}
                                r="1.5"
                                fill={color}
                                className="cursor-pointer"
                              >
                                <title>{agent.name}: {queuedValue} queued</title>
                              </circle>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
              {/* X-axis time labels */}
              <div className="flex justify-between text-[9px] text-white/40 mt-1 px-8">
                <span>10h ago</span>
                <span>8h</span>
                <span>6h</span>
                <span>4h</span>
                <span>2h</span>
                <span>Now</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                {(() => {
                  const agentColors = [
                    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1', '#94a3b8'
                  ];
                  return agents.map((agent, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: agent.agentId === 'orphan' ? '#94a3b8' : agentColors[i % agentColors.length] }}></div>
                      <span className="text-white/70 text-xs">{agent.name}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Emails Sent - Large Detailed */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white">Emails Sent</h2>
                <span className="text-white text-2xl font-bold">{stats.emailsSent}</span>
              </div>
              <div className="h-40 relative flex">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between text-[10px] text-white/50 pr-1" style={{ width: '30px' }}>
                  {(() => {
                    const maxSent = Math.max(...agents.map(a => a.sent || 0), 1);
                    let scale;
                    if (maxSent >= 1000) scale = 400;
                    else if (maxSent >= 400) scale = 200;
                    else if (maxSent >= 100) scale = 40;
                    else if (maxSent >= 40) scale = 20;
                    else scale = 4;
                    const maxRounded = Math.ceil(maxSent / scale) * scale;
                    const step = maxRounded / 4;
                    return [maxRounded, maxRounded - step, maxRounded - step*2, maxRounded - step*3, 0].map((val, i) => (
                      <span key={i} className="text-right">{val >= 1000 ? `${Math.floor(val/1000)}k` : Math.floor(val)}</span>
                    ));
                  })()}
                </div>
                <svg className="flex-1 h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Axes */}
                  <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  <line x1="0" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  
                  {/* Grid lines */}
                  <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  
                  {(() => {
                    const agentColors = [
                      '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                      '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1', '#94a3b8'
                    ];
                    
                    if (agents.length === 0) return null;
                    
                    // Calculate max from both current AND historical values
                    let maxSent = Math.max(...agents.map(a => a.sent || 0), 1);
                    agents.forEach(a => {
                      const hist = agentMetricsHistory[a.agentId] || [];
                      hist.forEach((h: any) => { if ((h.sent || 0) > maxSent) maxSent = h.sent; });
                    });
                    let scale;
                    if (maxSent >= 1000) scale = 400;
                    else if (maxSent >= 400) scale = 200;
                    else if (maxSent >= 100) scale = 40;
                    else if (maxSent >= 40) scale = 20;
                    else scale = 4;
                    const maxRounded = Math.ceil(maxSent / scale) * scale;
                    
                    return (
                      <>
                        {agents.map((agent, agentIdx) => {
                          const color = agent.agentId === 'orphan' ? '#94a3b8' : agentColors[agentIdx % agentColors.length];
                          const sentValue = agent.sent || 0;
                          const history = agentMetricsHistory[agent.agentId] || [];
                          
                          // Generate points from real historical data or show current value only
                          let points;
                          if (history.length >= 2) {
                            // Use real historical data, but ensure last point matches current value
                            const stepX = 100 / history.length;
                            points = history.map((snapshot, i) => {
                              const x = i * stepX;
                              const value = snapshot.sent || 0;
                              const y = 100 - (value / maxRounded) * 100;
                              return `${x},${Math.max(0, Math.min(100, y))}`;
                            });
                            // Add current value as final point at x=100
                            const currentY = 100 - (sentValue / maxRounded) * 100;
                            points.push(`100,${Math.max(0, Math.min(100, currentY))}`);
                            points = points.join(' ');
                          } else {
                            // No history yet - show flat line at current value
                            const y = 100 - (sentValue / maxRounded) * 100;
                            points = `0,${y} 100,${y}`;
                          }
                          
                          return (
                            <g key={agentIdx}>
                              <polyline
                                points={points}
                                fill="none"
                                stroke={color}
                                strokeWidth="0.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.9"
                              />
                              <circle
                                cx={100}
                                cy={100 - (sentValue / maxRounded) * 100}
                                r="1.5"
                                fill={color}
                                className="cursor-pointer"
                              >
                                <title>{agent.name}: {sentValue} sent</title>
                              </circle>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
              {/* X-axis time labels */}
              <div className="flex justify-between text-[9px] text-white/40 mt-1 px-8">
                <span>10h ago</span>
                <span>8h</span>
                <span>6h</span>
                <span>4h</span>
                <span>2h</span>
                <span>Now</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                {(() => {
                  const agentColors = [
                    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1', '#94a3b8'
                  ];
                  return agents.map((agent, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: agent.agentId === 'orphan' ? '#94a3b8' : agentColors[i % agentColors.length] }}></div>
                      <span className="text-white/70 text-xs">{agent.name}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Emails Sent Comparison */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white">Emails Sent Comparison</h2>
              </div>
              <div className="h-40 relative flex">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between text-[10px] text-white/50 pr-1" style={{ width: '30px' }}>
                  {(() => {
                    // Calculate max from both current AND historical values
                    let maxSent = Math.max(...agents.map(a => a.sent || 0), 1);
                    agents.forEach(a => {
                      const hist = agentMetricsHistory[a.agentId] || [];
                      hist.forEach((h: any) => { if ((h.sent || 0) > maxSent) maxSent = h.sent; });
                    });
                    let scale;
                    if (maxSent >= 1000) scale = 400;
                    else if (maxSent >= 400) scale = 200;
                    else if (maxSent >= 100) scale = 40;
                    else if (maxSent >= 40) scale = 20;
                    else scale = 4;
                    const maxRounded = Math.ceil(maxSent / scale) * scale;
                    const step = maxRounded / 4;
                    return [maxRounded, maxRounded - step, maxRounded - step*2, maxRounded - step*3, 0].map((val, i) => (
                      <span key={i} className="text-right">{val >= 1000 ? `${Math.floor(val/1000)}k` : Math.floor(val)}</span>
                    ));
                  })()}
                </div>
                <svg className="flex-1 h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Axes */}
                  <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  <line x1="0" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  
                  {/* Grid lines */}
                  <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  
                  {(() => {
                    const agentColors = [
                      '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                      '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1', '#94a3b8'
                    ];
                    
                    if (agents.length === 0) return null;
                    
                    // Calculate max from both current AND historical values
                    let maxSent = Math.max(...agents.map(a => a.sent || 0), 1);
                    agents.forEach(a => {
                      const hist = agentMetricsHistory[a.agentId] || [];
                      hist.forEach((h: any) => { if ((h.sent || 0) > maxSent) maxSent = h.sent; });
                    });
                    let scale;
                    if (maxSent >= 1000) scale = 400;
                    else if (maxSent >= 400) scale = 200;
                    else if (maxSent >= 100) scale = 40;
                    else if (maxSent >= 40) scale = 20;
                    else scale = 4;
                    const maxRounded = Math.ceil(maxSent / scale) * scale;
                    const numPoints = 10;
                    const stepX = 100 / (numPoints - 1);
                    
                    return (
                      <>
                        {agents.map((agent, agentIdx) => {
                          const color = agent.agentId === 'orphan' ? '#94a3b8' : agentColors[agentIdx % agentColors.length];
                          const sentValue = agent.sent || 0;
                          const history = agentMetricsHistory[agent.agentId] || [];
                          
                          // Generate points from real historical data
                          let points;
                          if (history.length >= 2) {
                            const stepX = 100 / history.length;
                            points = history.map((snapshot, i) => {
                              const x = i * stepX;
                              const value = snapshot.sent || 0;
                              const y = 100 - (value / maxRounded) * 100;
                              return `${x},${Math.max(0, Math.min(100, y))}`;
                            });
                            // Add current value as final point at x=100
                            const currentY = 100 - (sentValue / maxRounded) * 100;
                            points.push(`100,${Math.max(0, Math.min(100, currentY))}`);
                            points = points.join(' ');
                          } else {
                            // No history - show flat line at current value
                            const y = 100 - (sentValue / maxRounded) * 100;
                            points = `0,${y} 100,${y}`;
                          }
                          
                          return (
                            <g key={agentIdx}>
                              <polyline
                                points={points}
                                fill="none"
                                stroke={color}
                                strokeWidth="0.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.9"
                              />
                              {/* End point */}
                              <circle
                                cx={100}
                                cy={100 - (sentValue / maxRounded) * 100}
                                r="1.5"
                                fill={color}
                                className="cursor-pointer"
                              >
                                <title>{agent.name}: {sentValue} sent</title>
                              </circle>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
              {/* X-axis time labels */}
              <div className="flex justify-between text-[9px] text-white/40 mt-1 px-8">
                <span>10h ago</span>
                <span>8h</span>
                <span>6h</span>
                <span>4h</span>
                <span>2h</span>
                <span>Now</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                {(() => {
                  const agentColors = [
                    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1', '#94a3b8'
                  ];
                  return agents.map((agent, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: agent.agentId === 'orphan' ? '#94a3b8' : agentColors[i % agentColors.length] }}></div>
                      <span className="text-white/70 text-xs">{agent.name}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Emails Replied Comparison */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white">Emails Replied Comparison</h2>
              </div>
              <div className="h-40 relative flex">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between text-[10px] text-white/50 pr-1" style={{ width: '30px' }}>
                  {(() => {
                    // Calculate max from both current AND historical values
                    let maxReplied = Math.max(...agents.map(a => a.replied || 0), 1);
                    agents.forEach(a => {
                      const hist = agentMetricsHistory[a.agentId] || [];
                      hist.forEach((h: any) => { if ((h.replied || 0) > maxReplied) maxReplied = h.replied; });
                    });
                    let scale;
                    if (maxReplied >= 1000) scale = 400;
                    else if (maxReplied >= 400) scale = 200;
                    else if (maxReplied >= 100) scale = 40;
                    else if (maxReplied >= 40) scale = 20;
                    else scale = 4;
                    const maxRounded = Math.ceil(maxReplied / scale) * scale;
                    const step = maxRounded / 4;
                    return [maxRounded, maxRounded - step, maxRounded - step*2, maxRounded - step*3, 0].map((val, i) => (
                      <span key={i} className="text-right">{val >= 1000 ? `${Math.floor(val/1000)}k` : Math.floor(val)}</span>
                    ));
                  })()}
                </div>
                <svg className="flex-1 h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Axes */}
                  <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  <line x1="0" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  
                  {/* Grid lines */}
                  <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  
                  {(() => {
                    const agentColors = [
                      '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                      '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1', '#94a3b8'
                    ];
                    
                    if (agents.length === 0) return null;
                    
                    // Calculate max from both current AND historical values
                    let maxReplied = Math.max(...agents.map(a => a.replied || 0), 1);
                    agents.forEach(a => {
                      const hist = agentMetricsHistory[a.agentId] || [];
                      hist.forEach((h: any) => { if ((h.replied || 0) > maxReplied) maxReplied = h.replied; });
                    });
                    let scale;
                    if (maxReplied >= 1000) scale = 400;
                    else if (maxReplied >= 400) scale = 200;
                    else if (maxReplied >= 100) scale = 40;
                    else if (maxReplied >= 40) scale = 20;
                    else scale = 4;
                    const maxRounded = Math.ceil(maxReplied / scale) * scale;
                    const numPoints = 10;
                    const stepX = 100 / (numPoints - 1);
                    
                    return (
                      <>
                        {agents.map((agent, agentIdx) => {
                          const color = agent.agentId === 'orphan' ? '#94a3b8' : agentColors[agentIdx % agentColors.length];
                          const repliedValue = agent.replied || 0;
                          const history = agentMetricsHistory[agent.agentId] || [];
                          
                          // Generate points from real historical data
                          let points;
                          if (history.length >= 2) {
                            const stepX = 100 / history.length;
                            points = history.map((snapshot, i) => {
                              const x = i * stepX;
                              const value = snapshot.replied || 0;
                              const y = 100 - (value / maxRounded) * 100;
                              return `${x},${Math.max(0, Math.min(100, y))}`;
                            });
                            // Add current value as final point at x=100
                            const currentY = 100 - (repliedValue / maxRounded) * 100;
                            points.push(`100,${Math.max(0, Math.min(100, currentY))}`);
                            points = points.join(' ');
                          } else {
                            // No history - show flat line at current value
                            const y = 100 - (repliedValue / maxRounded) * 100;
                            points = `0,${y} 100,${y}`;
                          }
                          
                          return (
                            <g key={agentIdx}>
                              <polyline
                                points={points}
                                fill="none"
                                stroke={color}
                                strokeWidth="0.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.9"
                              />
                              {/* End point */}
                              <circle
                                cx={100}
                                cy={100 - (repliedValue / maxRounded) * 100}
                                r="1.5"
                                fill={color}
                                className="cursor-pointer"
                              >
                                <title>{agent.name}: {repliedValue} replied</title>
                              </circle>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
              {/* X-axis time labels */}
              <div className="flex justify-between text-[9px] text-white/40 mt-1 px-8">
                <span>10h ago</span>
                <span>8h</span>
                <span>6h</span>
                <span>4h</span>
                <span>2h</span>
                <span>Now</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                {(() => {
                  const agentColors = [
                    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1', '#94a3b8'
                  ];
                  return agents.map((agent, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: agent.agentId === 'orphan' ? '#94a3b8' : agentColors[i % agentColors.length] }}></div>
                      <span className="text-white/70 text-xs">{agent.name}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Sent Emails */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
              <h2 className="text-base font-bold text-white mb-3">Recent Agent Activity</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {agents.filter(a => a.agentId !== 'orphan').length === 0 ? (
                  <div className="text-center py-8 text-white/60">
                    <p className="text-xs">No agents configured</p>
                  </div>
                ) : (
                  agents.filter(a => a.agentId !== 'orphan').map((agent, i) => (
                    <div
                      key={i}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            agent.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                          }`}></div>
                          <div className="text-white font-medium text-sm">{agent.name}</div>
                        </div>
                        <span className="text-[#8FA6C1] text-[10px] uppercase">{agent.personality?.type || 'Agent'}</span>
                      </div>
                      <div className="text-white/70 text-xs">
                        {agent.status === 'running' ? (agent.currentActivity || 'Running') : 'Idle'}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[10px]">
                        <span className="text-purple-300">{agent.sent || 0} sent</span>
                        <span className="text-green-300">{agent.replied || 0} replied</span>
                        <span className="text-orange-300">{agent.queued || 0} queued</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Activity Logs */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white">Recent Activity</h2>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cycleEvents.length === 0 ? (
                  <div className="text-center py-8 text-white/60">
                    <p className="text-xs">No activity yet</p>
                  </div>
                ) : (
                  cycleEvents.slice(0, 20).map((activity, i) => {
                    const isError = activity.type === 'error';
                    const isCycle = activity.type === 'cycle_start' || activity.type === 'cycle_complete';
                    
                    return (
                      <div
                        key={i}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 transition-all"
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                            isError ? 'bg-red-400' : isCycle ? 'bg-green-400' : 'bg-blue-400'
                          }`}></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-xs font-medium">{activity.message}</div>
                            <div className="flex items-center gap-2 text-[9px] text-white/50 mt-0.5">
                              <span>{new Date(activity.timestamp).toLocaleDateString()}</span>
                              <span>•</span>
                              <span className="uppercase">{activity.agentName}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}{/* End Analytics Tab */}

      {/* AI Report Modal */}
      {viewingAiReport && (
        <>
          {/* Dark overlay covering everything including sidebar */}
          <div className="fixed inset-0 bg-black/60 z-[199]" onClick={() => setViewingAiReport(null)} />
          
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none"
          >
            <div 
              className="bg-gradient-to-br from-[#0a1628] via-[#0F1E35] to-[#1a2f4a] rounded-2xl shadow-2xl border border-[#4FD1FF]/30 w-full max-w-4xl max-h-[90%] overflow-hidden flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative flex items-start justify-between p-6 border-b border-[#4FD1FF]/20">
              <div className="flex-1">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white uppercase tracking-wider">Research Report</h3>
                  <p className="text-[#8FA6C1] text-sm mt-1">{viewingAiReport.companyName} • {viewingAiReport.contactName}</p>
                </div>
                
                {/* Quick Stats Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1525]/60 rounded border border-[#4FD1FF]/20">
                    <span className="text-xs text-[#8FA6C1]">Score</span>
                    <span className="text-sm font-bold text-[#4FD1FF]">{viewingAiReport.score}/100</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1525]/60 rounded border border-[#4FD1FF]/20">
                    <span className="text-xs text-[#8FA6C1]">Confidence</span>
                    <span className="text-sm font-bold text-white">{viewingAiReport.confidence}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1525]/60 rounded border border-[#4FD1FF]/20">
                    <span className="text-xs text-[#8FA6C1]">Sources</span>
                    <span className="text-sm font-bold text-white">{viewingAiReport.totalSources}</span>
                  </div>
                  <span className={`ml-auto px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider ${
                    viewingAiReport.tier === 'HIGHLY_QUALIFIED' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                    viewingAiReport.tier === 'QUALIFIED' ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border border-[#4FD1FF]/40' :
                    viewingAiReport.tier === 'SHOTGUN' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                    'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}>
                    {viewingAiReport.tier === 'HIGHLY_QUALIFIED' ? 'Highly Qualified' :
                     viewingAiReport.tier === 'QUALIFIED' ? 'Qualified' :
                     viewingAiReport.tier === 'SHOTGUN' ? 'Shotgun' :
                     'Rejected'}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => setViewingAiReport(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-4"
              >
                <XMarkIcon className="w-6 h-6 text-white/70" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* AI Analysis with Strengths */}
              <div className="bg-[#0A1525]/60 rounded-lg p-5 border border-[#4FD1FF]/20">
                <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider border-b border-[#4FD1FF]/20 pb-2">
                  Analysis
                </h4>
                <p className="text-[#8FA6C1] text-sm leading-relaxed whitespace-pre-wrap">{viewingAiReport.reasoning}</p>
                
                {/* Strengths inline */}
                {viewingAiReport.keyStrengths && viewingAiReport.keyStrengths.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#4FD1FF]/10">
                    <h5 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">
                      Strengths
                    </h5>
                    <ul className="space-y-2">
                      {viewingAiReport.keyStrengths.map((strength: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-[#8FA6C1] text-xs">
                          <span className="text-[#4FD1FF] mt-0.5">•</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Concerns */}
              {viewingAiReport.weaknesses && viewingAiReport.weaknesses.length > 0 && (
                <div className="bg-[#0A1525]/60 rounded-lg p-4 border border-yellow-500/30">
                  <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider border-b border-yellow-500/20 pb-2">
                    Concerns
                  </h4>
                  <ul className="space-y-2">
                    {viewingAiReport.weaknesses.map((weakness: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-[#8FA6C1] text-xs">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cited Evidence - Compact Cards */}
              {viewingAiReport.citedEvidence && viewingAiReport.citedEvidence.length > 0 && (
                <div className="bg-[#0A1525]/60 rounded-lg p-4 border border-[#4FD1FF]/20">
                  <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider border-b border-[#4FD1FF]/20 pb-2">
                    Key Evidence
                  </h4>
                  <div className="space-y-2">
                    {viewingAiReport.citedEvidence.map((evidence: any, i: number) => (
                      <div key={i} className="bg-black/20 rounded p-3 border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30 transition-colors">
                        <p className="text-[#8FA6C1] text-xs mb-2 leading-relaxed">{evidence.fact}</p>
                        <a 
                          href={evidence.source} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[10px] text-[#4FD1FF] hover:text-[#4FD1FF]/70 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span className="truncate max-w-[250px]">{evidence.source}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Research Sources - Compact List */}
              {viewingAiReport.allCitedFacts && viewingAiReport.allCitedFacts.length > 0 && (
                <div className="bg-[#0A1525]/60 rounded-lg p-4 border border-[#4FD1FF]/20">
                  <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider border-b border-[#4FD1FF]/20 pb-2">
                    All Sources ({(Array.from(new Set(viewingAiReport.allCitedFacts.map((f: any) => f.source))) as string[]).filter(s => s).length})
                  </h4>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {(Array.from(new Set(viewingAiReport.allCitedFacts.map((f: any) => f.source))) as string[])
                      .filter((source) => source)
                      .map((source, i) => {
                        const sourceTitle = viewingAiReport.allCitedFacts.find((f: any) => f.source === source)?.sourceTitle;
                        return (
                          <a
                            key={i}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-black/20 rounded hover:bg-black/30 transition-colors border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-3.5 h-3.5 text-[#4FD1FF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              {sourceTitle && <div className="text-white text-xs truncate">{sourceTitle}</div>}
                              <div className="text-[#8FA6C1] text-[10px] truncate">{source}</div>
                            </div>
                          </a>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Metadata Footer */}
              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-[10px] text-white/40">
                <div className="flex items-center justify-between">
                  <span>Evaluated: {new Date(viewingAiReport.evaluatedAt).toLocaleString()}</span>
                  <span className="px-2 py-1 bg-white/5 rounded">Quality: {viewingAiReport.researchQuality}</span>
                </div>
              </div>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Follow-up Modal */}
      {followUpModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[199]" onClick={() => setFollowUpModal(null)} />
          
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none">
            <div 
              className="bg-gradient-to-br from-[#0a1628] via-[#0F1E35] to-[#1a2f4a] rounded-2xl shadow-2xl border border-[#4FD1FF]/30 w-full max-w-2xl overflow-hidden flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#4FD1FF]/20">
                <div>
                  <h3 className="text-lg font-semibold text-white">Follow-up Details</h3>
                  <p className="text-[#8FA6C1] text-sm mt-1">To: {followUpModal.to}</p>
                </div>
                <button
                  onClick={() => setFollowUpModal(null)}
                  className="text-[#8FA6C1] hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Follow-up Date */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Scheduled Follow-up Date
                  </label>
                  {editingFollowUp ? (
                    <input
                      type="datetime-local"
                      value={editFollowUpDate}
                      onChange={(e) => setEditFollowUpDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-sm focus:border-[#4FD1FF]/50 focus:outline-none"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-sm">
                      {followUpModal.followUpDate 
                        ? new Date(followUpModal.followUpDate).toLocaleString()
                        : 'Not scheduled'}
                    </div>
                  )}
                </div>

                {/* Template */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Assigned Template
                  </label>
                  {editingFollowUp && agents.length > 0 ? (
                    <select
                      value={editTemplateId}
                      onChange={(e) => setEditTemplateId(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-sm focus:border-[#4FD1FF]/50 focus:outline-none"
                    >
                      {agents.find((a: any) => a.agentId === followUpModal.agentId)?.settings?.followUpTemplates?.templates?.map((template: any, idx: number) => (
                        <option key={idx} value={idx}>{template.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded">
                      <div className="text-white text-sm font-medium mb-2">
                        {followUpModal.assignedTemplate?.name || 'No template assigned'}
                      </div>
                      {followUpModal.assignedTemplate && (
                        <>
                          <div className="text-[#8FA6C1] text-xs mb-1">
                            Subject: {followUpModal.assignedTemplate.subject}
                          </div>
                          <div className="text-[#8FA6C1] text-xs whitespace-pre-wrap">
                            {followUpModal.assignedTemplate.body}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-[#4FD1FF]/20">
                <div className="text-xs text-[#8FA6C1]">
                  Scheduled: {followUpModal.followUpScheduledAt 
                    ? new Date(followUpModal.followUpScheduledAt).toLocaleDateString()
                    : 'N/A'}
                </div>
                <div className="flex gap-3">
                  {editingFollowUp ? (
                    <>
                      <button
                        onClick={() => setEditingFollowUp(false)}
                        className="px-4 py-2 text-sm text-[#8FA6C1] hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await api.put(`/api/email-queue/${followUpModal.id}/followup`, {
                              agentId: followUpModal.agentId,
                              templateId: editTemplateId,
                              followUpDate: editFollowUpDate ? new Date(editFollowUpDate).toISOString() : null
                            });
                            showToast('Follow-up updated', 'success');
                            setFollowUpModal(null);
                            setEditingFollowUp(false);
                            if (selectedQueue && selectedAgent) {
                              fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
                            }
                          } catch (error) {
                            console.error('Error updating follow-up:', error);
                            showToast('Failed to update follow-up', 'error');
                          }
                        }}
                        className="px-4 py-2 bg-[#4FD1FF] hover:bg-[#3FB8E8] text-black font-medium rounded text-sm transition-colors"
                      >
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingFollowUp(true)}
                      className="px-4 py-2 bg-[#4FD1FF] hover:bg-[#3FB8E8] text-black font-medium rounded text-sm transition-colors"
                    >
                      Edit Follow-up
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </AppLayout>
  );
} 
