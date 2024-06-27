import React, {useEffect, useRef, useState} from 'react';
import { Network } from 'vis-network/standalone/esm/vis-network';
import './styles.css'
import {useNavigate} from "react-router-dom";

const GraphVisualization = ({jwtToken}) => {
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [nodeSelectedEdges, setNodeSelectedEdges] = useState([]);
    const [ifaces, setIfaces] = useState([]);
    const [showDetails, setShowDetails] = useState(false);
    const [nodeLocations, setNodeLocations] = useState({});
    const [nodeNotes, setNodeNotes] = useState({});
    const networkRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const container = document.getElementById('graph-container');
        const initialNodes = [
        ];
        const initialEdges = [
        ];
        const data = {
            nodes: initialNodes,
            edges: initialEdges,
        };
        const options = {
            nodes: {
                shape: 'box',
                color: {
                    background: '#fefefe',
                }
            },
            edges: {
                smooth: {
                    enabled: false
                },
            },
            interaction: {
                hover: true,
                selectConnectedEdges: false,
            },
            physics: {
                enabled: false,
            }
        };
        networkRef.current = new Network(container, data, options);

        networkRef.current.on('click', (params) => {
            setShowDetails(false);
            if (params.nodes.length === 0 && params.edges.length === 0) {
                setSelectedNode(null);
                setSelectedEdge(null);
                setNodeSelectedEdges([]);
            } else if (params.nodes.length > 0) {
                const clickedNodeId = params.nodes[0];
                const clickedNode = networkRef.current.body.data.nodes.get(clickedNodeId);
                setSelectedEdge(null);
                setSelectedNode(clickedNode);
                fetchIfaces(clickedNode.hostname).then(r => null);
                const connectedEdges = networkRef.current.body.data.edges.get({
                    filter: function (edge) {
                        return edge.from === clickedNodeId || edge.to === clickedNodeId;
                    }
                });
                setNodeSelectedEdges(connectedEdges);
            } else if (params.edges.length > 0) {
                const clickedEdgeId = params.edges[0];
                const clickedEdge = networkRef.current.body.data.edges.get(clickedEdgeId);
                setSelectedNode(null);
                setSelectedEdge(clickedEdge);
            }
        });

    }, []);

    const fetchDataBaseTopology = async () => {
        try {
            const response = await fetch('http://localhost:8000/get-topology', {
                headers: {
                    'Authorization': `Bearer ${jwtToken}`
                }
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const receivedJson = await response.json();
            receivedJson.nodes.forEach(node => {
                nodeLocations[node.id] = node.location;
                nodeNotes[node.id] = node.note;
            });
            let new_data = {
                nodes: receivedJson.nodes,
                edges: receivedJson.edges
            }
            networkRef.current.setData(new_data);

        } catch (error) {
            console.error('There was a problem with your fetch operation:', error);
        }
    };

    const getNodesEdges = () => {
        const nodes = networkRef.current.body.data.nodes.map(node => ({
            label: node.label,
            id: node.id,
            hostname: node.id,
            name: node.label,
            mac: node.mac,
            type: node.type,
            is_root: node.isRoot,
            root_iface_desc: node.rootIfaceDesc,
            location: nodeLocations[node.id] || '',
            note: nodeNotes[node.id] || '',
            x: networkRef.current.getPositions(node.id)[node.id].x,
            y: networkRef.current.getPositions(node.id)[node.id].y
        }));
        const edges = networkRef.current.body.data.edges.map(edge => ({
            from: edge.from,
            to: edge.to,
            hostname1: edge.from,
            hostname2: edge.to,
            mac1: edge.mac1,
            mac2: edge.mac2,
            iface1: edge.iface1,
            iface2: edge.iface2
        }));

        return {nodes, edges};
    }

    const exportToDatabase = async () => {
        try {
            const combinedData = getNodesEdges();
            if (combinedData.nodes.length === 0) {
                alert('Topology is empty, can\'t export');
                return;
            }
            const response = await fetch('http://localhost:8000/save-topology', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwtToken}`
                },
                body: JSON.stringify(combinedData)
            });

            if (!response.ok) {
                throw new Error('Failed to save topology');
            }

            alert('Topology saved successfully!');
        } catch (error) {
            alert('Failed to save topology: ' + error.message);
        }
    };

    const fetchIfaces = async (hostname) => {
        try {
            const response = await fetch('http://localhost:8000/ifaces/' + hostname, {
                headers: {
                    'Authorization': `Bearer ${jwtToken}`
                }
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const received_json = await response.json();
            setIfaces(received_json);
        } catch (error) {
            console.error('There was a problem with your fetch operation:', error);
        }
    }

    const getTopologyFromFile = async (event) => {
        event.preventDefault();
        const fileInput = document.getElementById('fileUpload');
        const file = fileInput.files[0];

        if (!file) {
            alert('File is not chosen');
            return;
        }

        try {
            const fileReader = new FileReader();
            fileReader.onload = (event) => {
                const jsonData = JSON.parse(event.target.result);
                const {nodes, edges} = jsonData;
                jsonData.nodes.forEach(node => {
                    nodeLocations[node.id] = node.location;
                    nodeNotes[node.id] = node.note;
                });
                let new_data = {
                    nodes: nodes,
                    edges: edges
                }
                networkRef.current.setData(new_data);
            };
            fileReader.readAsText(file);
        } catch (error) {
            console.error('Ошибка чтения файла:', error);
        }
    };

    const exportToFile = () => {
        const dataToExport = getNodesEdges();
        console.log(dataToExport);
        if (dataToExport.nodes.length === 0) {
            alert('Topology is empty, can\'t export');
            return;
        }
        const jsonData = JSON.stringify(dataToExport);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `data_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(link);
    };

    const toggleDetails = () => {
        setShowDetails(!showDetails);
    };

    const handleLocationChange = (event, nodeId) => {
        setNodeLocations(prevLocations => ({
            ...prevLocations,
            [nodeId]: event.target.value
        }));
    };

    const handleNotesChange = (event, nodeId) => {
        setNodeNotes(prevNotes => ({
            ...prevNotes,
            [nodeId]: event.target.value
        }));
    };

    const handleLogout = () => {
        localStorage.removeItem('jwtToken');
        navigate('/login');
    };

    return (
        <div style={{ height: '100vh', width: '100vw' }}>
            <div id="graph-container" style={{ height: '100%', width: '100%' }}></div>
            {selectedNode && (
                <div className={'sidebar-container'}>
                    <h2 className={'h2-sidebar'}>{selectedNode.label}</h2>
                    <p><code className={'highlight-blue'}>Hostname:</code> {selectedNode.hostname}</p>
                    <p><code className={'highlight-blue'}>MAC Address:</code> {selectedNode.mac}</p>
                    <p><code className={'highlight-blue'}>Device type:</code> {selectedNode.type}</p>
                    <p><code className={'highlight-blue'}>Is root:</code> {selectedNode.isRoot ? 'true' : 'false'}</p>
                    <p><code className={'highlight-blue'}>Root interface description:</code> {selectedNode.rootIfaceDesc === 'false' ? '-' : selectedNode.rootIfaceDesc}</p>
                    <p><code className={'highlight-blue'}>Location:</code> <input type="text" value={nodeLocations[selectedNode.id] || ''} onChange={(event) => handleLocationChange(event, selectedNode.id)} /></p>
                    <p><code className={'highlight-blue'}>Note:</code> <input type="text" value={nodeNotes[selectedNode.id] || ''} onChange={(event) => handleNotesChange(event, selectedNode.id)} /></p>

                    <button className={'button-blue'} onClick={toggleDetails}>
                        {showDetails ? 'Hide Details' : 'Show Details'}
                    </button>
                    {showDetails && (
                        <>
                            {nodeSelectedEdges.length > 0 && (
                                <div className={'details-container'}>
                                    <h2 className={'h2-sidebar'}>Direct connections</h2>
                                    <hr width={'100%'} size={'1'} color={'#f0f0f0'}></hr>
                                    {nodeSelectedEdges.map((edge, index) => (
                                        <div key={index} className={'details-item'}>
                                            <h3 className={'h3-sidebar'}>Device {index + 1}:</h3>
                                            <p><code className={'highlight-red'}>Hostname:</code> {selectedNode.hostname === edge.hostname1 ? edge.hostname2 : edge.hostname1}</p>
                                            <p><code className={'highlight-red'}>MAC:</code> {selectedNode.hostname === edge.hostname1 ? edge.mac2 : edge.mac1}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {ifaces.length > 0 && (
                                <div className={'details-container'}>
                                    <h2 className={'h2-sidebar'}>Device interfaces</h2>
                                    <hr width={'100%'} size={'1'} color={'#f0f0f0'}></hr>
                                    {ifaces.map((iface, index) => (
                                        <div key={index} className='details-item'>
                                            <h3 className={'h3-sidebar'}>Interface {index + 1}</h3>
                                            <p><code className={'highlight-blue'}>Name:</code> {iface.name}</p>
                                            <p><code className={'highlight-blue'}>Description:</code> {iface.description}</p>
                                            <p><code className={'highlight-blue'}>Type:</code> {iface.type}</p>
                                            <p><code className={'highlight-blue'}>Role:</code> {iface.role}</p>
                                            <p><code className={'highlight-blue'}>Status:</code> {iface.ifaceStatus}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            {selectedEdge && (
                <div className={"sidebar-container"}>
                    <h2 className={'h2-sidebar'}>{selectedEdge.hostname1} - {selectedEdge.hostname2} connection</h2>
                    <p><code className={'highlight-blue'}>Hostname 1:</code> {selectedEdge.hostname1}</p>
                    <p><code className={'highlight-blue'}>MAC 1:</code> {selectedEdge.mac1}</p>
                    <p><code className={'highlight-blue'}>Interface 1:</code> {selectedEdge.iface1}</p>
                    <hr width={'100%'} size={'1'} color={'#f0f0f0'}></hr>
                    <p><code className={'highlight-red'}>Hostname 2:</code> {selectedEdge.hostname2}</p>
                    <p><code className={'highlight-red'}>MAC 2:</code> {selectedEdge.mac2}</p>
                    <p><code className={'highlight-red'}>Interface 2:</code> {selectedEdge.iface2}</p>
                </div>
            )}
            <div style={{ position: 'fixed', bottom: 0, right: 0, padding: '10px' }}>
                <form className={"file-submit-form"} onSubmit={getTopologyFromFile}>
                    <input type="file" id="fileUpload"/>
                    <button type={"submit"} className={"button-blue"}>Import from file</button>
                </form>
                <button className={'button-blue'} onClick={fetchDataBaseTopology}>Import from DB</button>
                <button className={'button-red'} onClick={exportToDatabase}>Export to DB</button>
                <button className={'button-red'} onClick={exportToFile}>Export to file</button>
            </div>
            <div style={{ position: 'fixed', top: 0, right: 0, padding: '10px' }}>
                <button className={'button-red'} onClick={handleLogout}>Logout</button>
            </div>
        </div>
    );
};

export default GraphVisualization;