import os
from models import db
from flask import Flask

app = Flask(__name__)
db_path = os.path.join(os.getcwd(), 'instance', 'speak.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'speak-analysis-key'
db.init_app(app)

with app.app_context():
    db.create_all()
    print('Database initialized successfully')
