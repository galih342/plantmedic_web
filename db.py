def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="plantmedic_db"
    ) 