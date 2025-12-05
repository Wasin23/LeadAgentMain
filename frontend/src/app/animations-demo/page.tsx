'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UserMenu from '@/components/UserMenu';
import api from '@/lib/api';
import { geoOrthographic, geoPath, geoGraticule, geoMercator, geoAlbersUsa } from 'd3-geo';
import { feature } from 'topojson-client';

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
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [rotation, setRotation] = useState<[number, number]>([-100, -10]);
  const rotationRef = useRef<[number, number]>([-100, -10]);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [worldGeoData, setWorldGeoData] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [provinceData, setProvinceData] = useState<any>(null);

  // Real stats data
  const [stats, setStats] = useState({
    emailsQueued: 0,
    emailsSent: 0,
    emailsViewed: 0,
    alerts: 0
  });

  // Modal states
  const [selectedQueue, setSelectedQueue] = useState<{agentId: string | 'all', type: 'queued' | 'sent' | 'replied', agentName: string} | null>(null);
  const [queueEmails, setQueueEmails] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);

  // Fetch agents list
  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await api.get('/api/auth/agents');
      console.log('Fetched agents:', response.data.agents);
      setAgents(response.data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  // Fetch queue emails when agent is selected
  const fetchQueueEmails = async (agentId: string, type: 'queued' | 'sent' | 'replied') => {
    setLoadingQueue(true);
    try {
      let endpoint = '';
      if (type === 'queued') endpoint = `/api/email-queue/queue?agentId=${agentId}`;
      else if (type === 'sent') endpoint = `/api/email-queue/sent?agentId=${agentId}`;
      else if (type === 'replied') endpoint = `/api/email-queue/replied?agentId=${agentId}`;
      
      const response = await api.get(endpoint);
      setQueueEmails(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching queue emails:', error);
      setQueueEmails([]);
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleQueueClick = (type: 'queued' | 'sent' | 'replied', label: string) => {
    setSelectedQueue({ agentId: 'all', type, agentName: label });
    setSelectedAgent(null);
    fetchAgents();
  };

  const handleAgentSelect = (agent: any) => {
    if (!selectedQueue) return;
    setSelectedAgent(agent);
    fetchQueueEmails(agent.agentId, selectedQueue.type);
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
    setQueueEmails([]);
  };

  const handleApproveEmail = async (emailId: string) => {
    if (!selectedQueue || !selectedAgent) return;
    try {
      await api.post(`/api/email-queue/${emailId}/approve`, {
        agentId: selectedAgent.agentId
      });
      fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
      // Refresh stats
      const queuedResponse = await api.get('/api/email-queue/queue?agentId=all');
      const sentResponse = await api.get('/api/email-queue/sent?agentId=all');
      setStats(prev => ({
        ...prev,
        emailsQueued: Array.isArray(queuedResponse.data) ? queuedResponse.data.length : 0,
        emailsSent: Array.isArray(sentResponse.data) ? sentResponse.data.length : 0
      }));
    } catch (error) {
      console.error('Error approving email:', error);
    }
  };

  const handleRejectEmail = async (emailId: string) => {
    if (!selectedQueue || !selectedAgent) return;
    try {
      await api.delete(`/api/email-queue/${emailId}`, {
        data: { agentId: selectedAgent.agentId }
      });
      fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
      // Refresh stats
      const queuedResponse = await api.get('/api/email-queue/queue?agentId=all');
      setStats(prev => ({
        ...prev,
        emailsQueued: Array.isArray(queuedResponse.data) ? queuedResponse.data.length : 0
      }));
    } catch (error) {
      console.error('Error rejecting email:', error);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch queued emails
        const queuedResponse = await api.get('/api/email-queue/queue?agentId=all');
        const emailsQueued = Array.isArray(queuedResponse.data) ? queuedResponse.data.length : 0;

        // Fetch sent emails
        const sentResponse = await api.get('/api/email-queue/sent?agentId=all');
        const emailsSent = Array.isArray(sentResponse.data) ? sentResponse.data.length : 0;

        // Fetch replied/viewed emails
        const repliedResponse = await api.get('/api/email-queue/replied?agentId=all');
        const emailsViewed = Array.isArray(repliedResponse.data) ? repliedResponse.data.length : 0;

        // TODO: Fetch alerts from your alerts API
        const alerts = 0;

        setStats({
          emailsQueued,
          emailsSent,
          emailsViewed,
          alerts
        });
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

  // Fetch real world data
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(res => res.json())
      .then(data => {
        // Convert TopoJSON to GeoJSON
        const countries = feature(data, data.objects.countries);
        setWorldGeoData(countries);
      })
      .catch(() => {
        // Fallback to simplified data if fetch fails
        setWorldGeoData(worldData);
      });
  }, []);

  // Fetch province/state data when country is selected
  useEffect(() => {
    if (!selectedCountry || !isExpanded || !selectedFeature) {
      setProvinceData(null);
      return;
    }

    // Fetch detailed state/province data for the selected country
    // Using a higher resolution dataset
    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(res => res.json())
      .then(data => {
        if (selectedCountry === 'United States of America' || selectedCountry === 'United States') {
          const states = feature(data, data.objects.states);
          setProvinceData(states);
        } else {
          // For other countries, try to get from world-atlas
          fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
            .then(res => res.json())
            .then(data => {
              const provinces = feature(data, data.objects.countries);
              setProvinceData(provinces);
            })
            .catch(() => setProvinceData(null));
        }
      })
      .catch(() => {
        setProvinceData(null);
      });
  }, [selectedCountry, isExpanded, selectedFeature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldGeoData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 1200;

    const drawGlobe = () => {
      const currentRotation = rotationRef.current;
      
      const projection = geoOrthographic()
        .scale(isExpanded && selectedFeature ? 800 : 500)
        .translate([canvas.width / 2, canvas.height / 2])
        .rotate(currentRotation);

      const path = geoPath(projection, ctx as any);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isExpanded && selectedFeature) {
        // When expanded, use Mercator projection for flat view
        
        // Special handling for USA to center on continental US
        if (selectedCountry === 'United States of America' || selectedCountry === 'United States') {
          // Use Albers USA projection which automatically handles Alaska and Hawaii
          const albersProjection = geoAlbersUsa();
          
          if (albersProjection) {
            albersProjection.fitSize([canvas.width * 0.9, canvas.height * 0.9], selectedFeature);
            
            const translate = albersProjection.translate();
            albersProjection.translate([
              translate[0] + (canvas.width - canvas.width * 0.9) / 2,
              translate[1] + (canvas.height - canvas.height * 0.9) / 2
            ]);
            
            const flatPath = geoPath(albersProjection, ctx as any);
            
            // Draw the country
            ctx.beginPath();
            flatPath(selectedFeature);
            ctx.fillStyle = 'rgba(147, 197, 253, 0.3)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Draw states if available
            if (provinceData) {
              const features = provinceData.features || [];
              features.forEach((feature: any) => {
                ctx.beginPath();
                flatPath(feature);
                ctx.fillStyle = 'rgba(147, 197, 253, 0.2)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              });
            }
          }
        } else {
          // For other countries, use regular Mercator
          const flatProjection = geoMercator();
          flatProjection.fitSize([canvas.width * 0.9, canvas.height * 0.9], selectedFeature);
          
          const translate = flatProjection.translate();
          flatProjection.translate([
            translate[0] + (canvas.width - canvas.width * 0.9) / 2,
            translate[1] + (canvas.height - canvas.height * 0.9) / 2
          ]);
          
          const flatPath = geoPath(flatProjection, ctx as any);
          
          // Draw the country
          ctx.beginPath();
          flatPath(selectedFeature);
          ctx.fillStyle = 'rgba(147, 197, 253, 0.3)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Draw provinces/states if available
          if (provinceData) {
            const features = provinceData.features || [];
            features.forEach((feature: any) => {
              ctx.beginPath();
              flatPath(feature);
              ctx.fillStyle = 'rgba(147, 197, 253, 0.2)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            });
          }
        }
      } else {
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
          
          const isSelected = selectedCountry === feature.properties?.name;
          ctx.fillStyle = isSelected ? 'rgba(147, 197, 253, 0.8)' : 'rgba(255, 255, 255, 0.7)';
          ctx.fill();
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.stroke();
        });

        // Outer glow
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const gradient = ctx.createRadialGradient(centerX, centerY, 480, centerX, centerY, 510);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        ctx.beginPath();
        ctx.arc(centerX, centerY, 505, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
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
  }, [worldGeoData, isExpanded, selectedFeature, provinceData, selectedCountry]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHasDragged(false);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;

    // Mark as dragged if there's significant movement
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      setHasDragged(true);
    }

    setRotation(prev => [
      prev[0] + deltaX * 0.25,
      Math.max(-90, Math.min(90, prev[1] - deltaY * 0.25))
    ]);

    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only allow selection if user didn't drag
    if (hasDragged) return;
    
    // Don't handle clicks when already expanded (in country detail view)
    if (isExpanded) return;
    
    const canvas = canvasRef.current;
    if (!canvas || !worldGeoData) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const currentRotation = rotationRef.current;
    const projection = geoOrthographic()
      .scale(500)
      .translate([canvas.width / 2, canvas.height / 2])
      .rotate(currentRotation);

    // Check which country was clicked
    const features = worldGeoData.features || [];
    for (const feature of features) {
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.beginPath();
      const path = geoPath(projection, ctx);
      path(feature);
      
      if (ctx.isPointInPath(x, y)) {
        const countryName = feature.properties?.name || 'Unknown';
        setSelectedCountry(countryName);
        setSelectedFeature(feature);
        setIsExpanded(true);
        return;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
      {/* Top Navigation Buttons */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex gap-3">
        <button
          onClick={() => router.push('/agents')}
          className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20"
        >
          Agents
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20"
        >
          Dashboard
        </button>
        <button
          onClick={() => router.push('/analytics')}
          className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20"
        >
          Analytics
        </button>
        <button
          onClick={() => router.push('/settings')}
          className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20"
        >
          Settings
        </button>
      </div>

      {/* Meridian Logo */}
      <div className="fixed top-8 left-8 z-50">
        <div className="text-white text-2xl font-bold">
          Meridian
        </div>
      </div>

      {/* User Menu */}
      <div className="fixed top-8 right-8 z-50">
        <div className="[&_button]:!bg-white/20 [&_button]:hover:!bg-white/30 [&_button]:!text-white [&_button]:backdrop-blur-sm [&_button]:rounded-xl [&_div>div>div:nth-child(2)_button]:!text-neutral-900 [&_div>div>div:nth-child(2)_button]:hover:!bg-neutral-50 [&_div>div>div:nth-child(3)_button]:!text-red-600 [&_div>div>div:nth-child(3)_button]:hover:!bg-red-50">
          <UserMenu />
        </div>
      </div>

      {/* Stats Panel - Left Side */}
      <div className="fixed left-8 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-4">
        {/* Email Queue */}
        <button
          onClick={() => handleQueueClick('queued', 'Email Queue')}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 w-[180px] hover:bg-white/20 transition-all cursor-pointer text-left"
        >
          <div className="text-white/70 text-sm mb-1">Email Queue</div>
          <div className="text-4xl font-bold text-white">{stats.emailsQueued}</div>
        </button>

        {/* Emails Sent */}
        <button
          onClick={() => handleQueueClick('sent', 'Sent Emails')}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 w-[180px] hover:bg-white/20 transition-all cursor-pointer text-left"
        >
          <div className="text-white/70 text-sm mb-1">Sent</div>
          <div className="text-4xl font-bold text-white">{stats.emailsSent}</div>
        </button>

        {/* Emails Viewed */}
        <button
          onClick={() => handleQueueClick('replied', 'Viewed Emails')}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 w-[180px] hover:bg-white/20 transition-all cursor-pointer text-left"
        >
          <div className="text-white/70 text-sm mb-1">Viewed</div>
          <div className="text-4xl font-bold text-white">{stats.emailsViewed}</div>
        </button>

        {/* Alerts */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 w-[180px]">
          <div className="text-white/70 text-sm mb-1">Alerts</div>
          <div className="text-4xl font-bold text-white flex items-center gap-2">
            {stats.alerts}
            {stats.alerts > 0 && (
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </div>
        </div>
      </div>

      {/* Back Button - Fixed at top center when expanded */}
      {isExpanded && selectedCountry && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-3">{selectedCountry}</h1>
            <button 
              onClick={() => {
                setIsExpanded(false);
                setSelectedCountry(null);
                setSelectedFeature(null);
                setProvinceData(null);
              }}
              className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-sm transition-all"
            >
              ← Back to Globe
            </button>
          </div>
        </div>
      )}

      <div 
        className={`fixed left-1/2 -translate-x-1/2 transition-all duration-700 ease-out ${
          isExpanded ? 'top-1/2 -translate-y-1/2' : 'bottom-0 translate-y-1/2'
        }`}
      >
        <div className="text-center">
          {!isExpanded && (
            <div className="mb-6 animate-fade-in">
              <h1 className="text-4xl font-bold text-white mb-2">Global Reach</h1>
              <p className="text-white/80">Drag to explore • Click a country to zoom in</p>
            </div>
          )}
          
          <canvas
            ref={canvasRef}
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleCanvasClick}
          />
        </div>
      </div>

      {/* Email Queue Modal */}
      {selectedQueue && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-white/20">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedAgent && (
                  <button
                    onClick={handleBackToAgents}
                    className="text-white/70 hover:text-white text-xl"
                  >
                    ←
                  </button>
                )}
                <h2 className="text-2xl font-bold text-white">
                  {selectedAgent ? selectedAgent.name : selectedQueue.agentName}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedQueue(null);
                  setSelectedAgent(null);
                  setQueueEmails([]);
                }}
                className="text-white/70 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!selectedAgent ? (
                // Show agents list
                loadingAgents ? (
                  <div className="text-center py-12">
                    <div className="text-white/70">Loading agents...</div>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-white/70">No agents found</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {agents.map((agent) => (
                      <button
                        key={agent.agentId}
                        onClick={() => handleAgentSelect(agent)}
                        className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all text-left"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          {agent.avatar && (
                            <img 
                              src={agent.avatar} 
                              alt={agent.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <div className="font-bold text-white text-lg">{agent.name}</div>
                        </div>
                        <div className="text-sm text-white/70">
                          {agent.personality?.name || 'Agent'}
                        </div>
                        <div className="mt-3 text-xs text-white/50">
                          Click to view {selectedQueue?.type} emails
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                // Show emails for selected agent
                loadingQueue ? (
                  <div className="text-center py-12">
                    <div className="text-white/70">Loading emails...</div>
                  </div>
                ) : queueEmails.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-white/70">No emails found</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {queueEmails.map((email) => (
                      <div key={email._id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-semibold text-white">{email.to}</div>
                            <div className="text-sm text-white/70">{email.subject}</div>
                          </div>
                          {selectedQueue.type === 'queued' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveEmail(email._id)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectEmail(email._id)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-white/90 whitespace-pre-wrap bg-white/5 rounded-lg p-3">
                          {email.body}
                        </div>
                        {email.scheduledFor && (
                          <div className="text-xs text-white/50 mt-2">
                            Scheduled: {new Date(email.scheduledFor).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
