document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');

    const routes = {
        '/': 'renderDashboard',
        '/features': 'renderFeatures',
        '/model-hub-local': 'renderModelHubLocal',
        '/model-hub-online': 'renderModelHubOnline',
        '/prompts': 'renderPrompts',
        '/toolbox': 'renderToolbox',
        '/knowledge': 'renderKnowledge',
        '/playground': 'renderPlayground'
    };

    function router() {
        const path = window.location.hash.slice(1) || '/';
        const handlerName = routes[path];
        if (handlerName && typeof window[handlerName] === 'function') {
            window[handlerName]();
            addEventListeners();
        } else {
            app.innerHTML = '<h1>Page Not Found</h1>';
        }
    }

    function addEventListeners() {
        // Use event delegation
        app.addEventListener('click', (e) => {
            // Knowledge Stacks
            if (e.target.matches('.delete-btn')) {
                document.querySelector('.modal-overlay').style.display = 'flex';
            }
            if (e.target.matches('.cancel-btn') || e.target.matches('.modal-overlay')) {
                document.querySelector('.modal-overlay').style.display = 'none';
            }
            if (e.target.matches('.confirm-delete-btn')) {
                console.log('Stack deleted');
                document.querySelector('.modal-overlay').style.display = 'none';
            }
            if (e.target.matches('.new-stack-btn')) console.log('New Stack');
            if (e.target.matches('.details-btn')) console.log('View Details');
            if (e.target.matches('.add-source-btn')) console.log('Add Data Source');

            // Model Hub - Local
            if (e.target.matches('.load-btn')) console.log('Load Model');
            if (e.target.matches('.unload-btn')) console.log('Unload Model');
            if (e.target.matches('.config-btn')) console.log('Configure Model');

            // Model Hub - Online
            if (e.target.matches('.connect-btn')) console.log('Connect Model');

            // Prompts Library
            if (e.target.matches('.new-prompt-btn')) console.log('New Prompt');
            if (e.target.matches('.prompt-buttons button')) {
                 if (e.target.textContent === 'Save') console.log('Save Prompt');
                 if (e.target.textContent === 'Edit') console.log('Edit Prompt');
                 if (e.target.textContent === 'Share') console.log('Share Prompt');
            }

            // AI Playground
            if (e.target.matches('.compare-btn')) console.log('Compare Prompts');
            if (e.target.matches('.share-btn')) console.log('Share Session');
            if (e.target.matches('.reset-btn')) console.log('Reset Playground');
            if (e.target.matches('.close-tutorial-btn')) {
                document.querySelector('.tutorial-overlay').style.display = 'none';
            }
        });
    }

    window.addEventListener('hashchange', router);
    router(); // Initial call
});

function renderDashboard() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="sidebar">
            <div class="logo">Msty Studio</div>
            <button class="new-btn">+ New</button>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="#/" class="active"><i class="material-icons">chat_bubble_outline</i> Conversations</a></li>
                    <li><a href="#/work"><i class="material-icons">work_outline</i> Work - Team Alpha</a></li>
                    <li><a href="#/personal"><i class="material-icons">person_outline</i> Personal</a></li>
                </ul>
            </nav>
            <div class="user-profile">
                <div class="user-info">
                    <img src="https://i.pravatar.cc/40" alt="User Avatar">
                    <span>User</span>
                </div>
                <i class="material-icons">settings</i>
            </div>
        </div>
        <div class="main-content">
            <div class="project-details">
                <h2>Future Campaign</h2>
                <div class="image-generation">
                    <h3>Image Generation</h3>
                    <img src="https://picsum.photos/1280/720" alt="AI generated cityscape">
                    <p>An AI-generated cityscape embodying the core themes of our upcoming 'Future Forward' campaign. The image blends organic architecture with advanced technology, reflecting a sustainable and innovative urban future. This asset will be central to our visual marketing strategy.</p>
                </div>
            </div>
        </div>
        <div class="chat-panel">
            <div class="chat-header">
                <h3>AI Assistant</h3>
                <span>auto_awesome</span>
            </div>
            <div class="chat-messages">
                <div class="message ai-message">
                    <p>Welcome to Zeeks AI! I can help you with a variety of tasks. Try asking me to generate some ideas for your campaign.</p>
                </div>
            </div>
            <div class="chat-input">
                <input type="text" placeholder="Type your message...">
                <button><i class="material-icons">send</i></button>
            </div>
        </div>
        <div class="mobile-overlay">
            <div class="mobile-header">
                <i class="material-icons">arrow_back</i>
                <span>AI Chat</span>
                <i class="material-icons">more_vert</i>
            </div>
            <div class="mobile-chat">
                <div class="message user-message">
                    <p>Can you help me with my campaign?</p>
                </div>
                <div class="message ai-message">
                    <p>Of course! What are you looking for?</p>
                </div>
            </div>
        </div>
    `;
}

function renderFeatures() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="sidebar">
            <div class="logo">Msty Studio</div>
            <button class="new-btn">+ New</button>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="#/"><i class="material-icons">chat_bubble_outline</i> Conversations</a></li>
                    <li><a href="#/features" class="active"><i class="material-icons">star_outline</i> Features</a></li>
                    <li><a href="#/model-hub-local"><i class="material-icons">storage</i> Model Hub - Local</a></li>
                    <li><a href="#/model-hub-online"><i class="material-icons">cloud_queue</i> Model Hub - Online</a></li>
                    <li><a href="#/prompts"><i class="material-icons">description</i> Prompts Library</a></li>
                    <li><a href="#/toolbox"><i class="material-icons">build</i> Toolbox - MCP Tools</a></li>
                    <li><a href="#/knowledge"><i class="material-icons">book</i> Knowledge Stacks - RAG</a></li>
                    <li><a href="#/playground"><i class="material-icons">science</i> AI Playground</a></li>
                </ul>
            </nav>
            <div class="user-profile">
                <div class="user-info">
                    <img src="https://i.pravatar.cc/40" alt="User Avatar">
                    <span>User</span>
                </div>
                <i class="material-icons">settings</i>
            </div>
        </div>
        <div class="main-content">
            <div class="features-overview">
                <h1>Features</h1>
                <div class="feature-card">
                    <h3>Universal Integrations</h3>
                    <p>Bridge your workflows and connect with APIs, databases, and external tools via MCP.</p>
                </div>
                <div class="feature-card">
                    <h3>Equipped Personas</h3>
                    <p>Assign tools to personas to perform tasks.</p>
                </div>
                <div class="feature-card">
                    <h3>Live Contexts</h3>
                    <p>Bring fresh data into conversations with API-connected contexts.</p>
                </div>
                <div class="feature-card">
                    <h3>Workflow Automation</h3>
                    <p>Automate repetitive, multi-step processes.</p>
                </div>
                <div class="feature-card">
                    <h3>Core Features</h3>
                    <ul>
                        <li>Model Hub - Local Models</li>
                        <li>Model Hub - Online Models</li>
                        <li>Conversations</li>
                        <li>Split Chats</li>
                        <li>Prompts Library</li>
                        <li>Toolbox - MCP Tools</li>
                        <li>Knowledge Stacks - RAG</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
}

function renderModelHubLocal() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="sidebar">
            <div class="logo">Msty Studio</div>
            <button class="new-btn">+ New</button>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="#/"><i class="material-icons">chat_bubble_outline</i> Conversations</a></li>
                    <li><a href="#/features"><i class="material-icons">star_outline</i> Features</a></li>
                    <li><a href="#/model-hub-local" class="active"><i class="material-icons">storage</i> Model Hub - Local</a></li>
                    <li><a href="#/model-hub-online"><i class="material-icons">cloud_queue</i> Model Hub - Online</a></li>
                    <li><a href="#/prompts"><i class="material-icons">description</i> Prompts Library</a></li>
                    <li><a href="#/toolbox"><i class="material-icons">build</i> Toolbox - MCP Tools</a></li>
                    <li><a href="#/knowledge"><i class="material-icons">book</i> Knowledge Stacks - RAG</a></li>
                    <li><a href="#/playground"><i class="material-icons">science</i> AI Playground</a></li>
                </ul>
            </nav>
            <div class="user-profile">
                <div class="user-info">
                    <img src="https://i.pravatar.cc/40" alt="User Avatar">
                    <span>User</span>
                </div>
                <i class="material-icons">settings</i>
            </div>
        </div>
        <div class="main-content">
            <div class="model-hub-local">
                <h1>Model Hub - Local Models</h1>
                <div class="local-model-card">
                    <div class="model-info">
                        <h3>Ollama Llama 2</h3>
                        <span class="status loaded">Loaded</span>
                        <p>Local Installation: /usr/local/models/llama2</p>
                        <p>Resource Allocation: 8GB RAM, 4 CPU Cores</p>
                    </div>
                    <div class="model-actions">
                        <button class="unload-btn">Unload</button>
                        <button class="config-btn">Configure</button>
                    </div>
                </div>
                <div class="local-model-card">
                    <div class="model-info">
                        <h3>Ollama Mistral</h3>
                        <span class="status unloaded">Unloaded</span>
                        <p>Local Installation: /usr/local/models/mistral</p>
                        <p>Resource Allocation: Not Allocated</p>
                    </div>
                    <div class="model-actions">
                        <button class="load-btn">Load</button>
                        <button class="config-btn">Configure</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderModelHubOnline() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="sidebar">
            <div class="logo">Msty Studio</div>
            <button class="new-btn">+ New</button>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="#/"><i class="material-icons">chat_bubble_outline</i> Conversations</a></li>
                    <li><a href="#/features"><i class="material-icons">star_outline</i> Features</a></li>
                    <li><a href="#/model-hub-local"><i class="material-icons">storage</i> Model Hub - Local</a></li>
                    <li><a href="#/model-hub-online" class="active"><i class="material-icons">cloud_queue</i> Model Hub - Online</a></li>
                    <li><a href="#/prompts"><i class="material-icons">description</i> Prompts Library</a></li>
                    <li><a href="#/toolbox"><i class="material-icons">build</i> Toolbox - MCP Tools</a></li>
                    <li><a href="#/knowledge"><i class="material-icons">book</i> Knowledge Stacks - RAG</a></li>
                    <li><a href="#/playground"><i class="material-icons">science</i> AI Playground</a></li>
                </ul>
            </nav>
            <div class="user-profile">
                <div class="user-info">
                    <img src="https://i.pravatar.cc/40" alt="User Avatar">
                    <span>User</span>
                </div>
                <i class="material-icons">settings</i>
            </div>
        </div>
        <div class="main-content">
            <div class="model-hub-online">
                <h1>Model Hub - Online Models</h1>
                <div class="online-model-card">
                    <div class="model-info">
                        <h3>OpenAI GPT-4</h3>
                        <p>Provider: OpenAI</p>
                        <p>Pricing: $0.03/1K tokens (prompt) + $0.06/1K tokens (completion)</p>
                    </div>
                    <div class="model-actions">
                        <button class="connect-btn">Connect</button>
                        <button class="config-btn">Configure</button>
                    </div>
                </div>
                <div class="online-model-card">
                    <div class="model-info">
                        <h3>Anthropic Claude 3 Opus</h3>
                        <p>Provider: Anthropic</p>
                        <p>Pricing: $15/1M tokens (prompt) + $75/1M tokens (completion)</p>
                    </div>
                    <div class="model-actions">
                        <button class="connect-btn">Connect</button>
                        <button class="config-btn">Configure</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPrompts() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="sidebar">
            <div class="logo">Msty Studio</div>
            <button class="new-btn">+ New</button>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="#/"><i class="material-icons">chat_bubble_outline</i> Conversations</a></li>
                    <li><a href="#/features"><i class="material-icons">star_outline</i> Features</a></li>
                    <li><a href="#/model-hub-local"><i class="material-icons">storage</i> Model Hub - Local</a></li>
                    <li><a href="#/model-hub-online"><i class="material-icons">cloud_queue</i> Model Hub - Online</a></li>
                    <li><a href="#/prompts" class="active"><i class="material-icons">description</i> Prompts Library</a></li>
                    <li><a href="#/toolbox"><i class="material-icons">build</i> Toolbox - MCP Tools</a></li>
                    <li><a href="#/knowledge"><i class="material-icons">book</i> Knowledge Stacks - RAG</a></li>
                    <li><a href="#/playground"><i class="material-icons">science</i> AI Playground</a></li>
                </ul>
            </nav>
            <div class="user-profile">
                <div class="user-info">
                    <img src="https://i.pravatar.cc/40" alt="User Avatar">
                    <span>User</span>
                </div>
                <i class="material-icons">settings</i>
            </div>
        </div>
        <div class="main-content">
            <div class="prompts-library">
                <h1>Prompts Library</h1>
                <div class="prompts-actions">
                    <input type="text" placeholder="Search prompts...">
                    <button class="new-prompt-btn">New Prompt</button>
                </div>
                <div class="prompt-card">
                    <div class="prompt-info">
                        <h3>Creative Writing Starter</h3>
                        <p>A prompt to kickstart creative writing sessions.</p>
                        <div class="tags">
                            <span>creative</span>
                            <span>writing</span>
                        </div>
                    </div>
                    <div class="prompt-buttons">
                        <button>Save</button>
                        <button>Edit</button>
                        <button>Share</button>
                    </div>
                </div>
                 <div class="prompt-card">
                    <div class="prompt-info">
                        <h3>Technical Question</h3>
                        <p>A prompt to ask a technical question to an AI.</p>
                        <div class="tags">
                            <span>technical</span>
                            <span>qa</span>
                        </div>
                    </div>
                    <div class="prompt-buttons">
                        <button>Save</button>
                        <button>Edit</button>
                        <button>Share</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderToolbox() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="sidebar">
            <div class="logo">Msty Studio</div>
            <button class="new-btn">+ New</button>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="#/"><i class="material-icons">chat_bubble_outline</i> Conversations</a></li>
                    <li><a href="#/features"><i class="material-icons">star_outline</i> Features</a></li>
                    <li><a href="#/model-hub-local"><i class="material-icons">storage</i> Model Hub - Local</a></li>
                    <li><a href="#/model-hub-online"><i class="material-icons">cloud_queue</i> Model Hub - Online</a></li>
                    <li><a href="#/prompts"><i class="material-icons">description</i> Prompts Library</a></li>
                    <li><a href="#/toolbox" class="active"><i class="material-icons">build</i> Toolbox - MCP Tools</a></li>
                    <li><a href="#/knowledge"><i class="material-icons">book</i> Knowledge Stacks - RAG</a></li>
                    <li><a href="#/playground"><i class="material-icons">science</i> AI Playground</a></li>
                </ul>
            </nav>
            <div class="user-profile">
                <div class="user-info">
                    <img src="https://i.pravatar.cc/40" alt="User Avatar">
                    <span>User</span>
                </div>
                <i class="material-icons">settings</i>
            </div>
        </div>
        <div class="main-content">
            <div class="toolbox-mcp">
                <h1>Toolbox - MCP Tools</h1>
                <div class="tool-card disabled">
                    <h3>API Connector</h3>
                    <p>Connect to any API and use it as a tool.</p>
                    <span class="premium-label">Premium</span>
                </div>
                <div class="tool-card disabled">
                    <h3>Database Connector</h3>
                    <p>Connect to your databases and query them.</p>
                    <span class="premium-label">Premium</span>
                </div>
                <div class="tool-card">
                    <h3>Web Search</h3>
                    <p>Search the web for information.</p>
                </div>
            </div>
        </div>
    `;
}

function renderKnowledge() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="sidebar">
            <div class="logo">Msty Studio</div>
            <button class="new-btn">+ New</button>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="#/"><i class="material-icons">chat_bubble_outline</i> Conversations</a></li>
                    <li><a href="#/features"><i class="material-icons">star_outline</i> Features</a></li>
                    <li><a href="#/model-hub-local"><i class="material-icons">storage</i> Model Hub - Local</a></li>
                    <li><a href="#/model-hub-online"><i class="material-icons">cloud_queue</i> Model Hub - Online</a></li>
                    <li><a href="#/prompts"><i class="material-icons">description</i> Prompts Library</a></li>
                    <li><a href="#/toolbox"><i class="material-icons">build</i> Toolbox - MCP Tools</a></li>
                    <li><a href="#/knowledge" class="active"><i class="material-icons">book</i> Knowledge Stacks - RAG</a></li>
                    <li><a href="#/playground"><i class="material-icons">science</i> AI Playground</a></li>
                </ul>
            </nav>
            <div class="user-profile">
                <div class="user-info">
                    <img src="https://i.pravatar.cc/40" alt="User Avatar">
                    <span>User</span>
                </div>
                <i class="material-icons">settings</i>
            </div>
        </div>
        <div class="main-content">
            <div class="knowledge-stacks">
                <h1>Knowledge Stacks</h1>
                <div class="knowledge-actions">
                    <input type="text" placeholder="Search stacks...">
                    <button class="new-stack-btn">New Stack</button>
                </div>
                <div class="stack-card active">
                    <div class="stack-info">
                        <h3>Project Documents</h3>
                        <p>Contains all documents related to the 'Future Forward' campaign.</p>
                    </div>
                    <div class="stack-buttons">
                        <button>Edit</button>
                        <button class="delete-btn">Delete</button>
                        <button class="details-btn">View Details</button>
                    </div>
                </div>
                <div class="stack-card">
                    <div class="stack-info">
                        <h3>General Knowledge</h3>
                        <p>A general-purpose knowledge base.</p>
                    </div>
                    <div class="stack-buttons">
                        <button>Edit</button>
                        <button class="delete-btn">Delete</button>
                        <button class>View Details</button>
                    </div>
                </div>
                <button class="add-source-btn">Add Data Source</button>
            </div>
        </div>
        <div class="modal-overlay" style="display:none;">
            <div class="modal">
                <h3>Are you sure?</h3>
                <p>Do you really want to delete this stack? This process cannot be undone.</p>
                <div class="modal-buttons">
                    <button class="cancel-btn">Cancel</button>
                    <button class="confirm-delete-btn">Delete</button>
                </div>
            </div>
        </div>
    `;
}

function renderPlayground() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="sidebar">
            <div class="logo">Msty Studio</div>
            <button class="new-btn">+ New</button>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="#/"><i class="material-icons">chat_bubble_outline</i> Conversations</a></li>
                    <li><a href="#/features"><i class="material-icons">star_outline</i> Features</a></li>
                    <li><a href="#/model-hub-local"><i class="material-icons">storage</i> Model Hub - Local</a></li>
                    <li><a href="#/model-hub-online"><i class="material-icons">cloud_queue</i> Model Hub - Online</a></li>
                    <li><a href="#/prompts"><i class="material-icons">description</i> Prompts Library</a></li>
                    <li><a href="#/toolbox"><i class="material-icons">build</i> Toolbox - MCP Tools</a></li>
                    <li><a href="#/knowledge"><i class="material-icons">book</i> Knowledge Stacks - RAG</a></li>
                    <li><a href="#/playground" class="active"><i class="material-icons">science</i> AI Playground</a></li>
                </ul>
            </nav>
            <div class="user-profile">
                <div class="user-info">
                    <img src="https://i.pravatar.cc/40" alt="User Avatar">
                    <span>User</span>
                </div>
                <i class="material-icons">settings</i>
            </div>
        </div>
        <div class="main-content">
            <div class="ai-playground">
                <h1>AI Playground</h1>
                <div class="playground-layout">
                    <div class="playground-tabs">
                        <!-- Tabs will be dynamically rendered here -->
                    </div>
                    <div class="playground-main">
                        <div class="prompt-area">
                            <textarea placeholder="Enter your prompt here..."></textarea>
                            <div class="prompt-actions">
                                <button>Undo</button>
                                <button>Redo</button>
                                <button>Save Prompt</button>
                            </div>
                        </div>
                        <div class="output-area">
                            <!-- AI output will be displayed here -->
                        </div>
                    </div>
                    <div class="playground-sidebar">
                        <div class="model-selection">
                            <label for="model">Model</label>
                            <select id="model">
                                <option>OpenAI GPT-4</option>
                                <option>Anthropic Claude 3 Opus</option>
                                <option>Ollama Llama 2</option>
                            </select>
                        </div>
                        <div class="parameters">
                            <h4>Parameters</h4>
                            <label>Temperature: 0.7</label>
                            <input type="range" min="0" max="1" step="0.1" value="0.7">
                            <label>Max Tokens: 256</label>
                            <input type="range" min="1" max="2048" step="1" value="256">
                        </div>
                        <button class="compare-btn">Compare Prompts</button>
                        <button class="share-btn">Share Session</button>
                        <button class="reset-btn">Reset Playground</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="tutorial-overlay" style="display:none;">
            <div class="tutorial-content">
                <h2>Welcome to the AI Playground!</h2>
                <p>This is a quick start tutorial...</p>
                <button class="close-tutorial-btn">Got it!</button>
            </div>
        </div>
    `;
}
